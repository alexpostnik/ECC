# ECC: проверенное развёртывание в облаке Codex

Срез: **15 октября 2026 года**. Официальный native plugin ECC установлен
в отдельном постоянном контейнере в существующем облачном окружении.
Cloud-навык и native CLI используют общие исходные workflows, но остаются
двумя разными исполнителями. Защищённый профиль основной сессии не изменён.

## Как пользоваться

В новой задаче выбрать **ECC Cloud**, прикрепить нужный проект и описать результат:
«Исправь issue … и проверь результат». Агент читает правила проекта, выбирает
подходящий ECC workflow и использует доступные инструменты. История этой беседы
для выбора правил и workflows не нужна.

Для native hooks, браузера и памяти агент проверяет существующий `ecc-native`
по [рецепту запуска](../plugins/ecc-cloud/runtime/README.md). Новая беседа не
требует переустановки или повторного входа при сохранённом рабочем профиле.
Новая виртуальная машина требует восстановления: автоматический перенос Docker
volume между разными облачными машинами не обещается.

**Открытый завершающий шаг:** владелец подтверждает официальный device login
Codex. До успешного модельного запроса native model execution остаётся PENDING.
Присутствие локального auth-файла ранее давало `login status` success, но реальный
запрос вернул 401. Этот файл больше не подключён к контейнеру. Пароли, токены
и одноразовые коды в репозиторий не сохраняются. Cloud-агент продолжает работать
через свою существующую подписку независимо от этого отдельного входа.

## Что действительно проверено

| Проверка | Результат |
| --- | --- |
| Штатная установка | `marketplace add /opt/ecc-source`, `plugin add ecc@ecc`: ECC 2.2.3 установлен и включён |
| Полный installed inventory | Native `skills/list`: 311 canonical skills + 37 command shims, без discovery errors |
| Исходники | 311 skills, 71 agent guidance и 122 rules сверены с закреплённым checkout |
| Реальный hook | Native `hook/started` → `hook/completed`, SessionStart, 290 мс, передан обнаруженный тип проекта |
| Правила в новой сессии | Новый `debug prompt-input` содержит native-profile ECC route; существующие инструкции сохраняются |
| Проектные роли | `config/read`: загружены explorer, reviewer и docs_researcher; выполнение модели в этих ролях ещё не проверено |
| Память | CLI init/save/search/read/doctor; все 4 memory MCP tools; MCP save → новый CLI process read |
| Browser MCP | Реальные new_page, take_snapshot и evaluate_script подтвердили контрольный текст страницы |
| HTTPS | example.com открыт через managed proxy с импортированным CA, без отключения TLS-проверок |
| Пересоздание | Новый образ, native и browser пересозданы; установка, hook trust и память сохранены; browser/HTTPS повторно PASS |
| Память после пересоздания | `doctor.ok=true`, 2 записи, 0 invalid/duplicate/broken links |
| Повторная установка | Повторный bootstrap проходит, существующий AGENTS.md сохранён; runtime `__pycache__` не принят за порчу исходников |
| Реальная инженерная задача | Исправление cache checker из [PR #9](https://github.com/alexpostnik/ECC/pull/9) применено в рабочем проекте; 56/56 тестов внутри native container |
| Вход и модель | PENDING до подтверждения владельцем и успешного реального turn; hooks/MCP не выданы за ответ модели |

Версии: Codex **0.159.2**, ECC/native memory CLI **2.2.3**, Chrome DevTools MCP
**1.10.1**. Источник native plugin:
[`d50cf128d5ee8bf8e67241910d2dfc20779ba5e0`](https://github.com/alexpostnik/ECC/tree/d50cf128d5ee8bf8e67241910d2dfc20779ba5e0).
Рабочий образ после сборки с NSS tools:
`sha256:0d9c884b5259723fb545f211b3ee51224abf51369f35e41d0154255e809af070`.
Debian-пакеты разрешаются на момент сборки; pin образа Node не делает весь apt
набор неизменным. Подробные execution receipts сохранены в рабочем окружении.

## Изоляция и границы

Native home находится в `ecc-native-home`; проект подключён отдельным bind mount.
Браузер — отдельный контейнер без agent profile, авторизации и проекта. Он работает
от `node`, с read-only root, `cap_drop: ALL`, `no-new-privileges`, без host ports.
На этом ядре Chromium user namespaces недоступны. Его `--no-sandbox` ограничен
browser-only контейнером; Docker isolation и сетевые ограничения хоста сохранены.
CA импортируется в временный NSS database. Память проекта остаётся приватной.

Это поверхность ECC, поддерживаемая Codex. Установленный native hook — SessionStart;
события Claude Code не становятся событиями Codex. Опциональные внешние сервисы
подключаются под конкретную задачу и с их собственной авторизацией.

## Ошибки, обновления и участие

- [#9](https://github.com/alexpostnik/ECC/pull/9): узкий исправленный дефект
  проверки hooks, RED/GREEN и 56 тестов, независимое ревью. Это draft в нашем
  форке; принятие upstream не заявляется.
- [#10](https://github.com/alexpostnik/ECC/issues/10): native prompt catalog
  показывает 314 из 348 установленных ECC skills. Пропущенные навыки доступны
  через явный выбор по полному `skills/list`, в том числе TDD и verification-loop.
  Увеличение числа файлов само по себе не гарантирует видимость для модели.
- [#8](https://github.com/alexpostnik/ECC/pull/8): в первом hosted CI 42/43 jobs
  прошли, включая Linux full suite 8799/8799. Один Windows Node 22/Yarn тест
  failed; его source совпадает с upstream. Запрошен один rerun только failed lane.
  Полный CI и merge не объявлены завершёнными до его результата.
- [#2](https://github.com/alexpostnik/ECC/issues/2): нестабильность Cloud skill
  discovery остаётся отдельной проблемой платформенного контекста. Native install
  проверен независимо; успех native не закрывает эту issue автоматически.

Для обслуживания достаточно поручить агенту «обнови ECC и проверь совместимость».
Агент сравнивает upstream, готовит отдельную ветку, проверяет изменения, обновляет
тот же приватный Cloud-плагин и отдельно native pin/image, затем повторяет приёмку.
Автообновления во время работы не включены. Ошибки приложения идут в его issues,
ошибки ECC — в форк ECC с воспроизведением; общий исправленный дефект готовится
отдельным небольшим PR для сообщества.
