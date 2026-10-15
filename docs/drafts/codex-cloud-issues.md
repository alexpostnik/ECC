# Черновики issues для ECC в облаке Codex

Эти задачи подготовлены по подтверждённым наблюдениям текущей настройки.
Владелец включил Issues; повторная проверка API подтвердила `has_issues=true`.
Ранее публикация была заблокирована ответами HTTP 403/410. Ниже сохранены тексты
задач для дальнейшего сопровождения. Опубликованы
[#1](https://github.com/alexpostnik/ECC/issues/1),
[#2](https://github.com/alexpostnik/ECC/issues/2),
[#3](https://github.com/alexpostnik/ECC/issues/3) и
[#4](https://github.com/alexpostnik/ECC/issues/4).

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

В этом форке подготовлен приватный portable cloud package с оригинальными навыками ECC и одним маршрутизирующим skill. Он использует систему плагинов беседы. Discovery и чтение навыка подтверждены в основном контексте беседы; практический verification-loop ранее выполнен проверочным агентом (18/18 тестов). Это ограничение native-профиля текущего хоста, а не установленная ошибка upstream ECC.

### Критерии решения

- [x] Зафиксирован поддерживаемый платформой способ подключения ECC в managed cloud.
- [ ] Если доступен native install, он выполняется в разрешённом профиле без обхода защиты.
- [x] Если выбран cloud package, его навык обнаруживается и выполняет реальную задачу в беседе.
- [x] Документированы доступные возможности и отдельно недоступные native hooks, роли и MCP.

## 2. ECC Cloud: нестабильная доступность навыков после подключения

### Задача

Зафиксировать изменение доступности плагина между контекстами и внутри одного хода беседы. В следующем ходе основной беседы discovery и чтение навыка сначала заработали, но финальная проверка в том же ходе снова потеряла доступ. Причина повторного исчезновения навыков не установлена; задача остаётся открытой.

### Что уже проверено

- Private package создан в аккаунте пользователя.
- В архиве один обнаруживаемый entry skill `ecc`; 311 исходных навыков, 71 agent prompt и 122 файла rules приложены как references.
- Пакет привязан к коммиту `8a7449c08694b57a31a0974fa390ec5c3c5b55f1`.
- 18 тестов сборщика проходят; покрытие исполняемых строк — 146/154 (94,8%, Python stdlib trace).
- Через API владельца прочитаны и побайтно сверены entry skill, runtime, provenance, catalog, coding-standards и verification-loop.
- До подключения discovery возвращал пустые списки. После добавления плагина пользователем проверочный агент с обновлённым контекстом обнаружил `ecc-cloud:ecc`.
- Через package/resource из discovery прочитаны entry skill, runtime, source, catalog, canonical code-reviewer, coding-standards и verification-loop. Выполнены все 18 тестов сборщика, exit code 0.
- В предыдущем ходе основной контекст возвращал пустые cloud/executor списки; чтение того же package отклонялось с `skill package is not available`.
- После следующего сообщения пользователя основной контекст обнаружил `ecc-cloud:ecc` через штатный cloud discovery и прочитал entry, source, runtime, planner и verification-loop. Пересоздание плагина не потребовалось.
- В этом ходе инструкции planner и verification-loop применены к исправлению Codex-документации: 20/20 точечных тестов прошли, выполнено независимое ревью.
- Позднее в том же ходе cloud discovery снова вернул `skills: []`, `next_cursor: null`; чтение ECC завершилось `skill package is not available`. Пуст весь список cloud skills, а не только результат поиска ECC. Эти проверки не устанавливают причину изменения доступности.
- Скриншот пользователя показывает выбранный ECC в редакторе нового задания Work.

### Следующий шаг

Проверять discovery непосредственно в рабочем контексте и собирать условия повторного исчезновения навыков. Переход к следующему ходу один раз восстановил доступ, но не обеспечил его стабильность. Пересоздавать сохранённый пакет без установления причины не требуется. Приватная ссылка и release ID хранятся в локальном setup receipt; в публичное issue они не включены.

### Критерии приёмки

- [x] ECC появляется в skill discovery обновлённого проверочного агента.
- [x] Через полученный от discovery package/resource читаются entry skill и вложенный оригинальный workflow.
- [x] По catalog корректно разрешается путь к coding-standards.
- [x] Выполняется практическая проверка по verification-loop с реальным отчётом.
- [x] Проверены обновлённый агент и продолжение основной беседы; зафиксировано наблюдаемое восстановление доступа в следующем ходе.
- [ ] Установлены условия повторного исчезновения навыков и проверен устойчивый способ продолжения работы.
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

- [x] Codex-копия verification-loop синхронизирована с актуальной canonical логикой проверок.
- [x] Описание MCP различает native plugin, project configuration и legacy sync.
- [x] Связанные точечные tests/линтеры проходят.
- [x] Для возможного upstream contribution сохранён узкий scope: отдельный commit из двух файлов.

### Результат в форке

Исправлено в [df51bccd](https://github.com/alexpostnik/ECC/commit/df51bccdfc1d93b35e9a0cae3eadf20c6c40f2e8), ветка `work/cloud-setup`. Проверки: 20/20 targeted tests, валидатор 829 skill directories, Markdown lint, `git diff --check`, побайтовое совпадение копий. `npm audit`: 0 уязвимостей. Независимое ECC code-reviewer ревью не обнаружило дефектов. В первой sandbox-попытке config suite было 2 несовпадения stderr; повтор неизменённого suite в разрешённом режиме с дополнительным сетевым доступом прошёл 13/13. Полный suite и native install не запускались. Issue остаётся открытой до интеграции исправления; merge и upstream PR не выполнялись.

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
