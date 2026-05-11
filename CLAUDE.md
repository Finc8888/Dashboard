# CLAUDE.md — Личный репозиторий планов и заметок

Этот файл описывает структуру репозитория, контекст владельца и инструкции для Claude при работе с содержимым.

## Communication with Me

Challenge my decisions. If my approach is suboptimal, say so directly with technical rationale. Do not agree just because I said so.

Before showing any result (code, documentation, analysis), score it 1-10. If below 8 — improve it yourself first, then show the final version. Do not show intermediate drafts or mention the score unless asked.

After completing each task, suggest 2-3 concrete next improvements. Prioritize by pattern: if the same action sequence has appeared more than once — propose a skill, subagent, or script to automate it. Otherwise suggest the highest-leverage improvement: code quality, best practices, tooling, or documentation. Keep suggestions brief (one line each), do not implement unless asked.

> Template: `~/code/projects/claude_projects/CLAUDE.template.md` | New project: `/custom-init-claude` | Sync rules: `/custom-sync-claude-rules`

---

## 👤 Контекст владельца

- **Стек:** PHP / JS / SQL, подходы DDD, юнит-тесты
- **Цель:** Постепенный переход на Golang
- **Изучает:** Golang (переход с PHP), иностранный язык через Duolingo
- **Читает:** Список из 10 книг (Тед Чан → Ле Гуин → Лем → Хофштадтер) — см. `reading/list.md`
- **Активности:** Ранний старт с 7:00, Вечерний бег 19:00–20:00, Duolingo 20:00–21:00

---

## 📁 Структура репозитория

```
/
├── CLAUDE.md                  # Этот файл
├── ARCHITECTURE.md            # Полная архитектура системы (C4, сети, маршруты, localStorage)
├── PRODUCTIVITY_PLAN.md       # Основной план продуктивности, расписание, методики
├── README.md                  # Быстрый старт, обзор, Make-команды
├── docs/
│   ├── auth-architecture.md   # Архитектура единой аутентификации
│   └── MICROSERVICES_MIGRATION.md  # Планы миграции на микросервисы
├── DashboardCaddyfile         # Внутренний Caddyfile для Dashboard
├── ~/excalidraw/              # Excalidraw диаграммы архитектуры (вне репозитория)
│   └── dashboard-ui-architecture.excalidraw.json  # Архитектура Dashboard UI
├── www/
│   ├── index.html             # SPA: auth overlay + main content
│   ├── blog-wrapper.html      # iframe-обёртка для блога (Hugo не поддерживает nav)
│   ├── 403.html               # Страница 403 — нет прав доступа к проекту
│   ├── css/
│   │   ├── core.css           # Переменные, анимации, grid, header, footer, responsive
│   │   ├── panels.css         # Модальные окна, настройки виджетов, admin
│   │   └── widgets/           # Стили каждого виджета (по файлу)
│   ├── img/
│   │   └── logo.png           # Логотип Gladys (голова женщины-киборга)
│   └── js/
│       ├── core/
│       │   ├── utils.js           # uid(), escHtml(), todayStr(), showToast()
│       │   ├── widget-manager.js  # WidgetRegistry, registerWidget(), loadWidgetConfig(), applyWidgetConfig()
│       │   ├── projects.js        # Навигация по проектам
│       │   ├── clock-notif.js     # Часы + уведомления
│       │   ├── zen-mode.js        # Zen mode, day-off
│       │   ├── keyboard.js        # Горячие клавиши
│       │   ├── briefing.js        # Утренний брифинг + ретроспектива
│       │   └── export-import.js   # exportData(), importData()
│       ├── widgets/               # Один виджет = один файл с registerWidget()
│       │   └── widgets-config.json # Единый конфиг виджетов (label, zone, storageKeys, defaults)
│       ├── data/
│       │   ├── go-data.js         # Данные Go-уроков
│       │   └── training-data.js   # План тренировок + рекорды
│       ├── app.js             # Тонкий оркестратор (roundRect polyfill)
│       ├── auth.js            # Модуль аутентификации
│       └── word-of-day.js     # Слово дня
├── tests/                     # Jest UI тесты Dashboard (make test)
│   ├── Dockerfile             # Docker-контейнер для тестов
│   ├── package.json           # Jest + jsdom зависимости
│   └── src/                   # Тесты (core/, widgets/)
├── plans/
│   ├── productivity.md        # Основной план продуктивности
│   ├── golang-learning.md     # План изучения Go
│   └── weekly/                # Еженедельные планы
│       └── YYYY-WXX.md
├── notes/
│   ├── golang/                # Заметки по Go (концепции, сниппеты)
│   ├── php/                   # Заметки по PHP / текущие задачи
│   └── ideas/                 # Идеи и творческие мысли
├── journal/
│   └── YYYY-MM-DD.md          # Ежедневный трекинг
└── reading/
    ├── list.md                # Список чтения с трекером прогресса + содержание сборников/трилогий
    └── notes/                 # Заметки по книгам
```

---

## 📝 Форматы файлов

### Ежедневный журнал (`journal/YYYY-MM-DD.md`)

```markdown
# YYYY-MM-DD

## ✅ Главная задача дня
- [ ] ...

## 📗 Go сегодня
Тема: ...
Написал: ... строк / скриптов

## 🏃 Бег
- [ ] Выполнен

## 📱 Duolingo
- [ ] Выполнен

## 📖 Чтение
Книга: ...
До страницы: ...

## 🧠 Уровень энергии (1–10)
...

## 💬 Заметки
...
```

### Еженедельный план (`plans/weekly/YYYY-WXX.md`)

```markdown
# Неделя XX — YYYY

## 🎯 Цели недели
1. ...

## 🔴 Рабочие задачи
- [ ] ...

## 📗 Go
- [ ] ...

## 🔁 Ретроспектива (заполнить в пятницу)
- Что сделано:
- Что заблокировало:
- Что изменить:
```

---

## 🤖 Инструкции для Claude

### Общий тон и подход
- Отвечай **на русском языке**, если не указано иное
- Будь конкретным и практичным — без лишней воды
- Учитывай контекст: ограниченное время (1–2 часа глубокой работы в день), переход PHP → Go

### При работе с планами
- Не добавляй новые активности без запроса — расписание уже плотное
- При корректировке расписания — сохраняй фиксированные слоты: бег 19–20, Duolingo 20–21, Чтение 21:15–22:30
- Задачи формулируй конкретно: не "разобраться с Go", а "написать HTTP-хэндлер на Go с роутингом"

### При работе с заметками по Go
- Примеры кода — всегда на Go (не PHP), но можно добавить комментарий-параллель с PHP если концепция новая
- Придерживайся идиоматичного Go: интерфейсы, composition over inheritance, явная обработка ошибок
- DDD-паттерны переводи в Go-структуры (не тащи PHP-архитектуру напрямую)

### При работе с журналом
- Помогай заполнять, анализировать паттерны, замечать прогресс
- Если энергия несколько дней подряд ниже 5 — предложи пересмотреть нагрузку, не добавлять

### При работе с аутентификацией и авторизацией
- Auth Gateway — отдельный проект в `../Auth-Gateway/`
- Единый docker-compose запускает всё: `make up` (core) или `make up-all` (все проекты)
- JWT хранится в HttpOnly cookie `auth_token` — не в localStorage
- Роли: `admin` (полный доступ + админка), `user` (только Dashboard + проекты)
- Downstream-сервисы получают `X-Auth-User` / `X-Auth-Role` / `X-Auth-Username` от Caddy forward_auth
- Все downstream-проекты хранят `auth_user_id` для привязки данных к пользователю Auth Gateway
- Gladys Jobs: справочники (Companies, Skills) — admin only; вакансии — привязаны к user_id
- Gladys Chat: чаты привязаны через `auth_user_id`
- При удалении пользователя: Auth Gateway делает soft delete + удаляет сессии; в Gladys Jobs вакансии остаются (ON DELETE SET NULL)

### При работе с чтением и reading/list.md
- Трекер прогресса — `reading/list.md`: статус (⬜/🔄/✅), страница, журнал дат
- Сборники и трилогии содержат вложенные списки произведений (раскрываемые в UI)
- Связывай идеи из книг с программированием и архитектурой систем где уместно
- Не спойлери книги, которые ещё не читались (смотри на статус в списке)
- Список фиксированный, читается строго по порядку — не меняй очерёдность

### При работе с целями
- Цели привязаны к месяцу и году (не к фиксированным 30 дням)
- Recurring-цели (например «Ранний старт с 7 утра») автоматически переносятся каждый месяц
- Незавершённые цели автоматически переносятся в следующий период
- Архив хранит историю целей прошлых периодов

### При работе с виджетами
- **ОБЯЗАТЕЛЬНО** ознакомься с `docs/widget-guide.md` — там описаны структура, паттерны, чеклист и требования к тестам для виджетов
- Каждая функция-мутация виджета **должна** вызывать render после сохранения данных (паттерн render-after-save)
- При создании нового виджета — следуй чеклисту в `docs/widget-guide.md`, включая написание тестов

### При изменении кода Dashboard (www/)
- **ОБЯЗАТЕЛЬНО** после изменений в `www/js/app.js`, `www/index.html` или `www/css/style.css` проверь актуальность:
  - `ARCHITECTURE.md` — секция 6 (компоненты Dashboard, localStorage схема)
  - `CLAUDE.md` — структура репозитория (если добавлены/удалены файлы)
  - `PRODUCTIVITY_PLAN.md` — если изменились цели, расписание или метрики
  - `reading/list.md` — если изменился список чтения или его структура
  - `README.md` — если изменилась структура файлов проекта
- При добавлении нового ключа в localStorage — обновить таблицу в ARCHITECTURE.md секция 6.4
- При добавлении/удалении виджета — обновить mindmap в ARCHITECTURE.md секция 6.3
- Убедиться что export/import (`exportData`/`importData`) корректно обрабатывает все ключи localStorage

### При изменении подходов к созданию виджетов или проектов
- Если изменился порядок шагов, появился новый подводный камень или устарел старый подход:
  - `docs/widget-guide.md` — обновить если изменилась структура виджетов: `widgets-config.json`, `registerWidget`, `reorderWidgets`, `applyWidgetVisibility`, паттерн localStorage, export/import
  - `docs/project-registration-guide.md` — обновить если изменился `PROJECTS`, `PROJECT_PERMISSIONS`, схема Caddyfile для проектов, или паттерн разрешений Auth Gateway
  - `docs/new-project-guide.md` — обновить если изменился типовой стек нового проекта (Go-структура, MobX-паттерны, схема DB, Auth Gateway интеграция, Caddy-маршруты)
- При добавлении нового проекта в `PROJECTS` — убедиться что он задокументирован в `ARCHITECTURE.md`

---

## 🌐 Экосистема проектов Gladys

Все проекты находятся в `~/code/projects/` и объединены под брендом **Gladys**. Gladys Dashboard — центральный хаб, остальные проекты доступны через него.

### Брендинг
- **Логотип:** `www/img/logo.png` — голова женщины-киборга (общий для всех проектов)
- Логотип хранится **только** в основном проекте Dashboard, подпроекты ссылаются на `/img/logo.png` (абсолютный путь через Caddy gateway)
- Логотип в подпроектах — кликабельная ссылка на `/` (возврат в Dashboard), заменяет кнопку "← Dashboard"
- **Шрифт заголовков:** [Orbitron](https://fonts.google.com/specimen/Orbitron) (Google Fonts), gradient cyan→purple
- **Цвета бренда:** cyan `#06b6d4`, purple `#a78bfa`, blue `#3b82f6`

### Проекты и локальные пути

| Проект | UI-название | Девиз | Локальный путь | Стек |
|--------|------------|-------|----------------|------|
| **Dashboard** | Gladys Dashboard | Всё нужное рядом | `~/code/projects/Productivity/` | Vanilla JS, Caddy |
| **Auth Gateway** | Админ-панель | Ключи от всех дверей | `~/code/projects/Auth-Gateway/` | Go, JWT, Caddy forward_auth |
| **Chat** | Gladys Chat | Слова под замком | `~/code/projects/Gladys-Chat/` | Go, React (MobX), WebSocket, E2EE |
| **Jobs** | Gladys Jobs | Каждый шаг на счету | `~/code/projects/job-statistics-platform/` | Go API, React (MobX), MySQL |
| **Blog** | Gladys Blog | Мысли обретают форму | `~/code/projects/Gladys-Blog/` | Hugo, Nginx, Docker |
| **Blog Admin** | Gladys Blog Admin | За кулисами слов | `~/code/projects/Gladys-Blog/blog-admin/` | Vanilla JS |
| **Sketchbook** | Gladys Sketchbook | Пространство для вдохновения | `~/code/projects/sketchbook/` | React (MobX), Go API |

### Связи между проектами
- Все проекты проксируются через **Caddy** (конфиг в Productivity)
- Аутентификация — через **Auth Gateway** (`forward_auth`)
- Каждый downstream-проект получает заголовки `X-Auth-User` / `X-Auth-Role` / `X-Auth-Username`
- При работе с конкретным проектом — переходи в его директорию
- Логотип и шрифт Orbitron подключены во всех проектах

---

## 🚫 Чего не делать

- Не предлагать добавить YouTube / новости в расписание
- Не увеличивать количество задач в день — лучше меньше, но выполнено
- Не переусложнять структуру заметок — простота важнее полноты
- Не переключаться на английский без явной просьбы
