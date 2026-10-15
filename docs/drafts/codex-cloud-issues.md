# Черновики issues для ECC в облаке Codex

Эти задачи подготовлены по подтверждённым наблюдениям текущей настройки.
Публикация заблокирована: в форке выключен раздел Issues, а интеграция получает
HTTP 403 при попытке изменить эту настройку. Создание issue возвращает HTTP 410.
После включения Issues нужно проверить дубликаты и опубликовать задачи.

## 1. Codex cloud: защищённый профиль блокирует штатную установку ECC

### Проблема

В текущем managed cloud Codex нельзя записать native plugin state в активный профиль. Поэтому подготовленный checkout ECC и рабочий CLI сами по себе не позволяют установить ECC как native plugin этой сессии.

### Подтверждённые факты

- Codex CLI установлен: `/opt/codex/bin/codex`, версия `0.159.2`.
- Активный `CODEX_HOME`: `/run/codex-environment/codex-home`, доступен только для чтения.
- `/workspace/.codex` и `/workspace/.agents` также защищены от записи.
- Native marketplace inventory пуст; установленных native plugins нет.
- Переопределение `HOME`/`CODEX_HOME` и обход защищённых путей не выполнялись.

[Штатный путь ECC](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/.codex-plugin/README.md) записывает plugin state в активный профиль и требует новой сессии; hooks требуют отдельного доверия.

### Влияние

Нельзя считать ECC установленным native-плагином, включёнными hooks/MCP или автоматически загруженными навыками только по наличию файлов в checkout.

### Доступный вариант

В этом форке подготовлен приватный portable cloud package с оригинальными навыками ECC и одним маршрутизирующим skill. Он использует систему плагинов беседы. Подключение к конкретной беседе и сквозной запуск проверяются отдельно. Это ограничение текущего хоста, а не установленная ошибка upstream ECC.

### Критерии решения

- [ ] Зафиксирован поддерживаемый платформой способ подключения ECC в managed cloud.
- [ ] Если доступен native install, он выполняется в разрешённом профиле без обхода защиты.
- [ ] Если выбран cloud package, его навык обнаруживается и выполняет реальную задачу в беседе.
- [ ] Документированы доступные возможности и отдельно недоступные native hooks, роли и MCP.

## 2. ECC Cloud: документировать обновление доступных навыков после подключения

### Задача

Зафиксировать различие доступности плагина между уже выполняющимся и обновлённым контекстами после подключения. Сам сквозной запуск навыка в обновлённом контексте уже подтверждён; причина отсутствия обновления в основном контексте не установлена.

### Что уже проверено

- Private package создан в аккаунте пользователя.
- В архиве один обнаруживаемый entry skill `ecc`; 311 исходных навыков, 71 agent prompt и 122 файла rules приложены как references.
- Пакет привязан к коммиту `8a7449c08694b57a31a0974fa390ec5c3c5b55f1`.
- 18 тестов сборщика проходят; покрытие исполняемых строк — 146/154 (94,8%, Python stdlib trace).
- Через API владельца прочитаны и побайтно сверены entry skill, runtime, provenance, catalog, coding-standards и verification-loop.
- До подключения discovery возвращал пустые списки. После добавления плагина пользователем проверочный агент с обновлённым контекстом обнаружил `ecc-cloud:ecc`.
- Через package/resource из discovery прочитаны entry skill, runtime, source, catalog, canonical code-reviewer, coding-standards и verification-loop. Выполнены все 18 тестов сборщика, exit code 0.
- Основной уже выполняющийся контекст той же беседы продолжает возвращать пустые cloud/executor списки; чтение того же package отклоняется с `skill package is not available`.
- Скриншот пользователя показывает выбранный ECC в редакторе нового задания Work.

### Следующий шаг

Документировать проверенный путь: выбрать ECC Cloud, запустить задание с ним и проверить discovery непосредственно в рабочем контексте. Уточнить, когда уже выполняющийся контекст обновляет список навыков; не считать ограничение подтверждённой ошибкой платформы без дополнительной проверки. Приватная ссылка и release ID хранятся в локальном setup receipt; в публичное issue они не включены.

### Критерии приёмки

- [x] ECC появляется в skill discovery обновлённого проверочного агента.
- [x] Через полученный от discovery package/resource читаются entry skill и вложенный оригинальный workflow.
- [x] По catalog корректно разрешается путь к coding-standards.
- [x] Выполняется практическая проверка по verification-loop с реальным отчётом.
- [ ] Документирован момент обновления доступных навыков в основном рабочем контексте; проверены новый запуск и продолжение старой беседы.
- [x] Отчёт различает создание, подключение, чтение и исполнение; отсутствующие hooks/MCP не помечены включёнными.

[Сборщик и инструкция](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/plugins/ecc-cloud/README.md).

## 3. Синхронизировать Codex-копию verification-loop и описание MCP с актуальными исходниками

### Подтверждённое расхождение

В этом revision Codex-facing копия verification-loop отстаёт от canonical skill:

- [.agents/skills/verification-loop/SKILL.md](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/.agents/skills/verification-loop/SKILL.md#L21) использует pipelines без `pipefail`, `npx tsc` и `head`.
- [skills/verification-loop/SKILL.md](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/skills/verification-loop/SKILL.md#L23) уже содержит `pipefail`, `npx --no-install` и `sed` для сохранения реального exit status.

Кроме того, [.codex/AGENTS.md](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/.codex/AGENTS.md#L48) описывает старый набор MCP и семь managed servers. Актуальные [.codex-plugin/README.md](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/.codex-plugin/README.md) и [.mcp.json](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/.mcp.json) описывают один default native MCP — Chrome DevTools; project config сейчас не объявляет прежний набор.

### Влияние

Агент может следовать устаревшим проверкам или сообщать о подключениях, которых нет. Для cloud package выбраны canonical skills; их содержание не переписывалось.

### Критерии решения

- [ ] Codex-копия verification-loop синхронизирована с актуальной canonical логикой проверок.
- [ ] Описание MCP различает native plugin, project configuration и legacy sync.
- [ ] Связанные точечные tests/линтеры проходят.
- [ ] При подготовке upstream contribution сохранён узкий scope этого исправления.

## 4. Уточнить поддерживаемый путь guided Codex setup для пользовательского форка ECC

### Ограничение

Документация native plugin допускает marketplace из локального checkout. Однако guided Codex setup проверяет источник marketplace `ecc` на точное соответствие официальному `affaan-m/ECC` и отклоняет другой origin.

### Доказательства

- [Local checkout installation](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/.codex-plugin/README.md#L43).
- [Проверка provenance](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/scripts/lib/codex-plugin-setup.js#L267): при отличии от `NORMALIZED_OFFICIAL_MARKETPLACE_REPO` выдаётся `MARKETPLACE_COLLISION`.
- [configure-ecc](https://github.com/alexpostnik/ECC/blob/8a7449c08694b57a31a0974fa390ec5c3c5b55f1/skills/configure-ecc/SKILL.md) использует официальный источник.

Это подтверждено чтением кода. Полный runtime-сценарий guided setup с форком в этой среде не воспроизводился: активный native профиль защищён от записи.

### Влияние

Для пользователя, который намеренно работает со своим форком, generic guided setup нельзя описывать как взаимозаменяемый с native installation из checkout.

### Критерии решения

- [ ] Документирован отдельный поддерживаемый маршрут работы с форком.
- [ ] Проверка provenance сохраняет защиту от случайной подмены источника.
- [ ] Если нужен explicit trusted-fork режим, он проектируется отдельно и покрывается тестами; автоматическое ослабление проверки не предлагается.
- [ ] По возможности выполнена проверка в writable native Codex profile, с честным указанием результата.
