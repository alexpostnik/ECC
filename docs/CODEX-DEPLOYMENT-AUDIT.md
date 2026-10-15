# Аудит развёртывания ECC и порядок проверки

Срез: **15 октября 2026 года**. ECC Cloud уже выполнял реальные задачи через
установленный навык, но устойчивое подключение между контекстами не подтверждено.
Версия **0.1.2 опубликована в том же приватном плагине**. Новый агент без истории
беседы обнаружил пакет, прочитал новую версию, правила и workflows и успешно
выполнил 19 тестов сборщика. Устойчивость основного контекста пока не доказана.
Это адаптация workflows для облачного хоста, а не доказанная установка официального native plugin Codex и не полный паритет с Claude Code.

## Основание выводов

- Проверенный upstream: [`76aaa77d`][upstream]. Native manifests, configure-ecc,
  hook projection и приведённые ниже документы проверены на этом коммите.
- Проверенный remote `alexpostnik/ECC` main: [`b92f181b`][fork-main]. Это отдельная точка сравнения, а не обозначение текущей рабочей ветки.
- Исправления Cloud 0.1.1: RED [`d843a523`][red], GREEN [`0c25661e`][green].
  Полный набор исходников, версия и хеши задаются metadata каждого ZIP.
- Опубликованная 0.1.2 закреплена на [`9b0ce73d`][release-pin]. Сборка содержит
  815 файлов, из них 807 исходных references сверены по SHA-256. Для загрузки
  сохранены метаданные владельца и presentation из прежнего плагина; compatibility
  manifest — дополнительный 816-й файл. Это записано отдельно от исходного ZIP.
- SHA-256 исходного ZIP: `5f7097ebd5fee7b7aeadffe7058cbcf8abea290c47f1d7dd0fd8c97e871d7ce9`.
- Runtime-доказательства хранятся в приватных локальных receipts; публичный документ не содержит private plugin ID, ссылок на приватный пакет или credentials.
- Уровни доказательств различаются: исходный код → сборка → регистрация → discovery
  → чтение ресурсов → выполнение workflow. Успех одного уровня не доказывает следующий.

## Что именно доступно

| Возможность | Официальный Codex native | ECC Cloud и граница утверждения |
| --- | --- | --- |
| Skills | Native manifest подключает `./skills/` | Библиотека 311 skills упакована; один entry skill `ecc` маршрутизирует чтение. Исполнение всех 311 не проверено |
| Agents | Codex project roles; Claude agent files не устанавливаются как роли | 71 инструкция доступна как reference; это не 71 зарегистрированный автономный агент |
| Rules | Правила проекта и выбранные rule packs | 122 файла в библиотеке; в 0.1.1 обязательны применимые common и language rules перед реализацией, рефакторингом и ревью |
| Hooks | Projection содержит только `SessionStart`; требуется отдельное доверие | Не устанавливаются; чтение инструкций не включает автоматическое исполнение |
| MCP | `.mcp.json` объявляет default `chrome-devtools` | Сервер не запускается пакетом; используются отдельно подключённые инструменты хоста |
| Memory | CLI runtime и optional MCP подключаются отдельно | Автоматический сбор памяти не включён; utility требует соответствующего runtime |
| Repo-level scripts | Полный native cache содержит runtime-файлы | В reference corpus их нет; для нужной операции требуется соответствующий checkout |
| Обновление | Marketplace upgrade и plugin add | Пакет закреплён на snapshot; обновляется пересборкой того же private plugin |

Основание: [native manifest][native-manifest], [единственный hook event][native-hook],
[матрица возможностей][capability-map], [отдельный memory runtime][memory-contract],
[контракт Cloud][cloud-runtime]. В 0.1.1 сначала читается короткий `release.json`;
полный `source.json` остаётся для проверки целостности. Правила направляют работу
агента и не являются hook enforcement; точный порядок — в [entry skill][cloud-entry].

Upstream сам указывает **Partial** для паритета Codex с Claude Code.
Claude plugin устанавливает skills, agents, commands и hooks, но даже там rules
добавляются отдельно, а Memory Vault runtime не появляется на PATH автоматически
([Claude installation][claude-install], [memory][memory-contract]).

## Текущая проверка облака

| Проверка | Состояние и предел доказательства |
| --- | --- |
| Хост | Codex CLI 0.159.2 присутствует; активный `CODEX_HOME` read-only. Native install не предпринимался; обход защиты не выполнялся |
| Native catalog probe | HTTP 451, `no_biscuit_no_service`; причина неизвестна. Это не доказательство ошибки ECC или отсутствия прав пользователя |
| Cloud 0.1.0 | Были успешны discovery, чтение entry и nested references, разрешение catalog paths и реальная проверка сборщика: 18/18 тестов |
| Повторяемость подключения | После успешных запусков cloud skills снова исчезли из доступного контекста. [Issue #2][issue2] остаётся открытым |
| Cloud 0.1.1, код | 19/19 focused tests, 153/161 исполняемая строка (95,0%, Python trace); это не branch coverage. Независимое ревью пройдено |
| Cloud 0.1.2, сохранение | API владельца подтвердил версию и сохранение прежней presentation; 7 файлов побайтно сверены с исходным ZIP: entry, release, runtime, source, catalog, README, icon |
| Cloud 0.1.2, холодный старт | Новый агент без истории: discovery и чтение 0.1.2 PASS; common/Python rules, code-reviewer, verification-loop прочитаны через штатный skill reader. Реальные unittest: exit 0, 19 passed, 0 failed/errors/skipped |
| CI | Workflow тестирует сборщик, собирает реальный ZIP и проверяет полный inventory/хеши/provenance; [первый hosted run][ci-run] прошёл на `64e29579`, Ubuntu/Python 3.11 |
| Полный `npm test` | FAIL, exit 1: 7789 tests, 7721 passed, 68 failed; 405 files passed, 15 failed. Изоляция home, обнаружение пустого `/tmp/.git` и lifecycle дочерних процессов разобраны отдельно в [#7][issue7]; не все причины окончательно установлены |
| Mac | Доступа к пользовательскому Mac нет; native deployment и выполнение задач на нём не проверены |

## Замечания и приоритет

Значимость ниже относится к готовности развёртывания, а не безопасности. «Высокая уверенность» означает прямое наблюдение либо проверяемое соответствие исходникам; причины сбоев отдельно не установлены.

| Значимость / уверенность | Слой | Наблюдение и действие |
| --- | --- | --- |
| Высокая / высокая | Host runtime | Discovery нестабилен между контекстами; воспроизвести повторное подключение и сохранить результат в #2 |
| Высокая / высокая | Native acceptance | Native install и исполнение SessionStart на Mac не проверены; успешный Cloud workflow не закрывает этот отдельный gate |
| Средняя / высокая | Upstream static docs | [#6][issue6]: `cross-harness.md` и compliance catalog сохраняют старое instruction-backed описание Codex, несмотря на native SessionStart; это drift документации, не наблюдавшийся native failure |
| Средняя / высокая | Upstream cache checker | [#5][issue5]: fixture без hooks даёт exit 0 и `All cached manifest references resolve.`; контроль без skills — exit 1. Пробел подтверждён запуском валидатора; фактический hook runtime этим не проверялся |
| Средняя / высокая | Upstream static docs | README описывает устаревшее содержимое project config и 32 Codex skills при фактических 46; не использовать эти числа как inventory |

Источники статических замечаний: [cross-harness:28][stale-cross],
[compliance:75][stale-compliance], [cache references:143][cache-check],
[README:1580][stale-readme]. Эти замечания существуют и в проверенном upstream;
они не доказывают, что native installation на доступном Mac не работает.

## Приёмка Cloud 0.1.2

1. Собрать ZIP из выбранного commit, проверить metadata, хеши, paths и focused tests;
   сохранить hash артефакта. Обновить существующий private plugin, не создавать дубликат.
2. Через discovery получить фактический package/resource; прочитать entry,
   `release.json`, runtime и выбранный canonical workflow. Подтвердить версию 0.1.2.
3. Для кодовой задачи прочитать rules layering guide, common coding/testing/security,
   применимые language rules и development workflow перед реализацией/рефакторингом.
4. Выполнить полезную ограниченную задачу в существующем проекте с реальными checks.
   Проверить catalog path на `coding-standards`; записать пропуски и причины.
5. Повторить discovery/read/workflow в новой выбранной беседе и после обновления
   контекста. Закрывать #2 только по воспроизводимому результату, не по скриншоту выбора.

Сборка, публикация, discovery, чтение новой версии и один реальный workflow
подтверждены отдельно. Повторяемость после изменений контекста остаётся открытой
в #2. Нативные hooks/MCP/memory не входят в обещание Cloud-пакета.

Повторная проверка того же нового агента после обновления его контекста также
прошла: discovery, release 0.1.2, catalog из 311 записей и полный coding-standards
по разрешённому пути. В основном контексте последняя проверка по-прежнему вернула
пустой список cloud skills. Поэтому два успеха агента не закрывают #2.

Полный suite завершён отдельно от focused acceptance. Все 15 падающих тестовых
файлов и 12 связанных runtime-файлов совпали с исходным и текущим upstream.
Это исключает их прямую правку адаптером, но не доказывает отсутствие косвенных
эффектов. Детали причин и пределы выводов сохранены в #7; общий suite не PASS.

## Проверка на Mac в существующем проекте

Использовать имеющийся Mac и проект; Codespace не нужен. В терминале проекта проверить `codex --version`,
`codex plugin marketplace list --json`, `codex plugin list --json`.
Зафиксировать выбранный профиль и существующие регистрации, не менять `HOME` или
`CODEX_HOME`. Для native lifecycle нужен профиль, в который разрешена запись.

Выбрать **один** источник установки. Официальный маршрут из [upstream notes][native-install]:

```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
codex plugin list --json
```

При существующем официальном marketplace обновление выполняется через
`codex plugin marketplace upgrade ecc`, затем `codex plugin add ecc@ecc`.
Не накладывать native plugin на legacy sync. Если источник существующего `ecc`
другой, сначала разрешить конфликт источников, не перезаписывать его вслепую.

Для разработки своего форка native notes допускают `codex plugin marketplace add /absolute/path/to/ECC`, затем `codex plugin add ecc@ecc`.
Это альтернативный маршрут, не второй install поверх первого. Guided setup
проверяет именно официальный origin и может отклонить форк: [provenance check][provenance].
Не ослаблять эту проверку; ограничение и отдельный fork workflow отслеживаются в [#4][issue4].

После установки начать новую сессию Codex в том же проекте. Проверить discovery,
чтение skill и полезную задачу с реальными тестами. Из соответствующего ECC checkout
выполнить `node scripts/codex/check-plugin-cache.js`, учитывая его ограничение выше.
Для проверки **включённого** SessionStart открыть `/hooks`, изучить определение,
явно доверить ему исполнение и подтвердить фактический запуск в новой сессии.
MCP проверять отдельным реальным вызовом только если браузер нужен задаче.
Memory подключать отдельно по [контракту runtime][memory-contract], если она нужна.
До этих проверок состояние Mac deployment — **PENDING**, даже при успешном plugin list.

## Готовность к участию в upstream

Форк служит рабочей площадкой, а не доказательством принятия изменений upstream.
Cloud adapter остаётся частной адаптацией. Исправления verification-loop и MCP docs,
улучшение cache checker и обновление capability docs готовить отдельными узкими
вкладами с issue, воспроизведением и релевантными проверками. Не смешивать их с
private deployment receipts. Готовность к merge не заявлять до итогов полного suite,
ревью конкретного diff и применимых требований CONTRIBUTING/PR template.

## Ежедневная работа и обновления

В новой задаче выбрать ECC Cloud, указать нужный проект и поручить:
«Примени ECC: проверь release.json и доступные инструменты, прочитай AGENTS.md,
выбери применимые правила и workflow, выполни задачу и покажи реальные проверки».
Это инструкция для холодного старта; история нашей беседы ей не требуется.
Если skill discovery пуст, зафиксировать этот сбой в #2, не выдавая чтение
локальных файлов или API владельца за успешный запуск выбранного навыка.

Обновление форка и обновление плагина — две отдельные операции. После `git fetch upstream`
сравнить изменения, перенести нужные обновления в рабочую ветку, пройти проверки и ревью.
Затем собрать ZIP из выбранного commit, обновить тот же plugin с проверкой release ID,
прочитать сохранённые файлы и повторить холодный старт. Последний проверенный
upstream опережает исходную базу форка тремя коммитами только по PR moderation;
runtime/skills/manifests не изменились. Автоматической синхронизации пока нет.

Ошибки проекта сохранять в его issues, тестах и документации; ошибки ECC —
в форке ECC с воспроизведением. Общие улучшения готовить отдельными небольшими PR
к upstream. Выбор навыка сам по себе не накапливает память и не переносит уроки
между задачами: нужные выводы следует явно сохранять в репозитории.

[upstream]: https://github.com/affaan-m/ECC/commit/76aaa77df6adc5b889e689007bf99b9a4f74af34
[fork-main]: https://github.com/alexpostnik/ECC/commit/b92f181b3b748d1abbc2afd94af6aa7d8c8fca29
[red]: https://github.com/alexpostnik/ECC/commit/d843a5235da5a6df83316109377d0b0d4f998ae1
[green]: https://github.com/alexpostnik/ECC/commit/0c25661e16d7fb09bebbb746c4d71fe37e95f3a6
[release-pin]: https://github.com/alexpostnik/ECC/commit/9b0ce73df3ae167e63385eafbae3e99d9f224dcb
[ci-run]: https://github.com/alexpostnik/ECC/actions/runs/38797374533
[native-manifest]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/.codex-plugin/plugin.json#L23
[native-hook]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/hooks/codex-hooks.json#L4
[capability-map]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/README.md#L1437
[memory-contract]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/README.md#L1257
[cloud-runtime]: ../plugins/ecc-cloud/skills/ecc/references/runtime.md
[cloud-entry]: ../plugins/ecc-cloud/skills/ecc/SKILL.md
[claude-install]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/README.md#L294
[stale-cross]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/docs/architecture/cross-harness.md#L28
[stale-compliance]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/scripts/lib/harness-adapter-compliance.js#L75
[cache-check]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/scripts/codex/check-plugin-cache.js#L143
[stale-readme]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/README.md#L1580
[native-install]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/.codex-plugin/README.md#L22
[provenance]: https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/scripts/lib/codex-plugin-setup.js#L267
[issue2]: https://github.com/alexpostnik/ECC/issues/2
[issue4]: https://github.com/alexpostnik/ECC/issues/4
[issue5]: https://github.com/alexpostnik/ECC/issues/5
[issue6]: https://github.com/alexpostnik/ECC/issues/6
[issue7]: https://github.com/alexpostnik/ECC/issues/7
