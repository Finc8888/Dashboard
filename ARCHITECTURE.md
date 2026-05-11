# ARCHITECTURE.md — Gladys Dashboard (Unified Platform)

> Единая платформа-хаб для управления локальными Docker-проектами с централизованной аутентификацией, дашбордом продуктивности и интеграцией подпроектов.

---

## 1. Обзор системы

Gladys Dashboard — это оркестрирующий проект, который объединяет несколько независимых приложений под единым reverse proxy (Caddy), обеспечивает централизованную аутентификацию и предоставляет персональный дашборд продуктивности.

**Роль:** API Gateway + Dashboard UI + Infrastructure as Code
**Стек:** Caddy 2 (Gateway) · Vanilla JS (Dashboard) · Docker Compose · Make

---

## 2. Диаграмма системы (C4 — System Context)

```mermaid
flowchart TB
    USER((Пользователь))

    subgraph Platform["Productivity Platform"]
        GW["Caddy Gateway<br/>:80 / :443"]

        subgraph Core["Core Services"]
            DASH["Dashboard<br/>Caddy static :80"]
            AUTH["Auth Gateway<br/>Go API :8080"]
            AUTH_UI["Admin Panel<br/>Caddy SPA :80"]
            AUTH_DB[("Auth DB<br/>MySQL 8.0")]
        end

        subgraph Optional["Optional Services (profiles)"]
            BLOG["Gladys Blog<br/>Nginx :443"]
            JOBS_FE["Job Stats Frontend<br/>Caddy :3000"]
            JOBS_API["Job Stats API<br/>Go :8081"]
            JOBS_DB[("Jobs DB<br/>MySQL 8.0")]
        end
    end

    USER -->|"HTTP :80"| GW
    GW -->|"/"| DASH
    GW -->|"/api/auth/*"| AUTH
    GW -->|"/api/admin/*"| AUTH
    GW -->|"/admin/*"| AUTH_UI
    GW -->|"/blog/"| DASH
    GW -->|"/blog-raw/*"| BLOG
    GW -->|"/jobs/*"| JOBS_FE
    GW -->|"/jobs/api/*"| JOBS_API
    AUTH --> AUTH_DB
    JOBS_API --> JOBS_DB

    style Core fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style Optional fill:#2d2640,stroke:#a78bfa,color:#e2e8f0
```

---

## 3. Структура проекта

```
Productivity/
├── docker-compose.yaml       # Единая оркестрация всех сервисов
├── Caddyfile                 # Gateway: роутинг + headers + encoding
├── DashboardCaddyfile        # Внутренний static server Dashboard
├── Makefile                  # Команды управления: up, down, up-all, logs, status
├── .env                      # Секреты: JWT_SECRET, DB credentials
├── .env.example              # Шаблон переменных окружения
├── www/                      # Статические файлы Dashboard
│   ├── index.html            # SPA: auth overlay + main content
│   ├── blog-wrapper.html     # iframe-обёртка для блога (Hugo не поддерживает nav)
│   ├── 403.html              # Страница 403 — нет прав доступа к проекту
│   ├── css/
│   │   ├── core.css          # Переменные, анимации, grid, header, footer, responsive
│   │   ├── panels.css        # Модальные окна, настройки виджетов, admin
│   │   └── widgets/          # Стили каждого виджета (по файлу)
│   │       ├── quote.css … ai-assistant.css
│   │       └── server-build.css
│   ├── js/
│   │   ├── core/
│   │   │   ├── utils.js          # uid(), escHtml(), todayStr(), fmtDate(), showToast()
│   │   │   ├── widget-manager.js # WidgetRegistry, registerWidget(), visibility, reorder
│   │   │   ├── projects.js       # Навигация по проектам
│   │   │   ├── clock-notif.js    # Часы + уведомления
│   │   │   ├── zen-mode.js       # Zen mode, day-off, scroll arrows
│   │   │   ├── keyboard.js       # Горячие клавиши
│   │   │   ├── briefing.js       # Утренний брифинг + ретроспектива
│   │   │   └── export-import.js  # exportData(), importData()
│   │   ├── widgets/              # Каждый виджет — отдельный файл с registerWidget()
│   │   │   ├── quote.js          personal-bar.js    running.js
│   │   │   ├── schedule.js       todo.js            stickers.js
│   │   │   ├── weekend-plan.js   principles.js      key-skills.js
│   │   │   ├── goals.js          stats.js           reading.js
│   │   │   ├── productivity.js   go-roadmap.js      scratchpad.js
│   │   │   ├── server-build.js   ai-assistant.js
│   │   │   └── (каждый вызывает registerWidget() в конце)
│   │   ├── data/
│   │   │   ├── go-data.js        # Данные Go-уроков
│   │   │   └── training-data.js  # Загрузчик CSV: план тренировок + рекорды
│   │   ├── app.js            # Тонкий оркестратор (roundRect polyfill)
│   │   ├── auth.js           # Аутентификация: login, register, verify
│   │   └── word-of-day.js    # Слово дня: API + кэш + архив
│   ├── data/
│   │   ├── words.json              # Словарь для "Слова дня"
│   │   ├── dashboard-data-default.json  # Дефолтные данные для новых пользователей
│   │   ├── training_schedule.csv   # → symlink / docker mount из 5run
│   │   └── records_sorted.csv     # → symlink / docker mount из 5run
│   └── quotes.json           # Цитаты (генерируются из markdown)
├── tests/                    # Jest UI тесты Dashboard
│   ├── Dockerfile            # Docker-контейнер для тестов
│   ├── package.json          # Jest + jsdom зависимости
│   ├── jest.config.js        # Конфигурация Jest
│   └── src/                  # Тесты
│       ├── setup.js          # Глобальные моки (fetch, AudioContext, confirm)
│       ├── helpers.js        # Загрузчик JS-файлов Dashboard в jsdom
│       ├── core/             # Тесты core модулей
│       └── widgets/          # Тесты виджетов (CRUD, render, registration)
├── scripts/
│   └── parse_quotes.py       # Парсер цитат
├── docs/
│   ├── auth-architecture.md  # Документация auth-архитектуры
│   ├── widget-guide.md       # Руководство по созданию нового виджета
│   ├── project-registration-guide.md  # Руководство по регистрации проектов
│   └── new-project-guide.md  # Руководство по созданию нового проекта
└── CLAUDE.md                 # Инструкции для AI-ассистента
```

---

## 4. Сетевая архитектура

### 4.1 Docker Networks

```mermaid
flowchart TB
    subgraph gateway_net["gateway (bridge)"]
        GW["Caddy Gateway"]
        DASH["Dashboard"]
        AUTH["Auth Gateway"]
        AUTH_UI["Admin Panel"]
        BLOG["Gladys Blog"]
        JOBS_FE["Job Stats Frontend"]
        JOBS_API["Job Stats API"]
    end

    subgraph auth_net["auth-internal (bridge)"]
        AUTH2["Auth Gateway"]
        AUTH_DB["Auth DB"]
    end

    subgraph jobs_net["jobs-internal (bridge)"]
        JOBS_API2["Job Stats API"]
        JOBS_DB["Jobs DB"]
    end

    AUTH -..- AUTH2
    JOBS_API -..- JOBS_API2

    style gateway_net fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style auth_net fill:#3b1f2b,stroke:#ef4444,color:#e2e8f0
    style jobs_net fill:#2a2510,stroke:#f59e0b,color:#e2e8f0
```

### 4.2 Изоляция сетей

| Сеть | Участники | Назначение |
|------|-----------|-----------|
| `gateway` | Все сервисы + Caddy | Маршрутизация HTTP-трафика |
| `auth-internal` | Auth Gateway + Auth DB | Изоляция БД аутентификации |
| `jobs-internal` | Job Stats API + Jobs DB | Изоляция БД вакансий |

**Принцип:** Базы данных доступны только из своей internal-сети. Gateway-сеть обеспечивает связность между фронтендами и API через Caddy.

---

## 5. Caddy Gateway — маршрутизация

### 5.1 Таблица маршрутов

```
:80 {
    /api/auth/*          → auth-gateway:8080     (public, без forward_auth)
    /api/health          → auth-gateway:8080     (probe)
    /api/admin/*         → auth-gateway:8080     (protected middleware)

    /admin/*             → auth-admin:80         (strip /admin, perm: admin)
    /admin               → /admin/ (redirect)

    /blog/               → /srv/www/blog-wrapper.html (iframe, perm: blog)
    /blog                → /blog/ (redirect)
    /blog-raw/*          → gladys-blog:80        (strip /blog-raw)
    /blog-raw            → /blog-raw/ (redirect)

    /blog-admin/api/*    → blog-admin:8083       (strip /blog-admin, role: admin)
    /blog-admin/*        → blog-admin:8083       (strip /blog-admin, role: admin)
    /blog-admin          → /blog-admin/ (redirect)

    /jobs/api/*          → job-stats-api:8081    (strip /jobs)
    /jobs/*              → job-stats-frontend:3000 (strip /jobs, perm: jobs)
    /jobs                → /jobs/ (redirect)

    /chat/api/*          → gladys-chat-api:8082  (strip /chat)
    /chat/ws             → gladys-chat-api:8082  (strip /chat, WebSocket)
    /chat/*              → gladys-chat-frontend:80 (strip /chat, perm: chat)
    /chat                → /chat/ (redirect)

    /*                   → dashboard:80          (default, catch-all)
}

Контроль доступа на уровне Caddy (forward_auth + header_regexp X-Auth-Permissions):
- 401 (нет JWT) → redirect на /?redirect={path} → Dashboard показывает форму входа/регистрации
- Нет permission → Caddy отдаёт /srv/www/403.html (статическая страница)
```

### 5.2 Диаграмма маршрутизации

```mermaid
flowchart LR
    REQ["HTTP :80"] --> CADDY["Caddy Gateway"]

    CADDY -->|"/api/auth/*"| AUTH["Auth Gateway<br/>:8080"]
    CADDY -->|"/api/admin/*"| AUTH
    CADDY -->|"/admin/*"| ADMIN_UI["Admin Panel<br/>:80"]
    CADDY -->|"/blog/"| WRAPPER["blog-wrapper.html<br/>(static)"]
    CADDY -->|"/blog-raw/*"| BLOG["Gladys Blog<br/>:443"]
    CADDY -->|"/jobs/api/*"| JOBS_API["Job Stats API<br/>:8081"]
    CADDY -->|"/jobs/*"| JOBS_FE["Job Stats FE<br/>:3000"]
    CADDY -->|"/chat/api/*"| CHAT_API["Chat API<br/>:8082"]
    CADDY -->|"/chat/ws"| CHAT_API
    CADDY -->|"/chat/*"| CHAT_FE["Chat FE<br/>:80"]
    CADDY -->|"/*"| DASH["Dashboard<br/>:80"]

    WRAPPER -->|"iframe src"| BLOG

    CADDY -.->|"401"| REDIR["/?redirect={path}<br/>→ Dashboard login"]
    CADDY -.->|"no perm"| DENY["/403.html"]
```

### 5.3 HTTP Headers

| Path | Header | Значение |
|------|--------|---------|
| `*` | `X-Content-Type-Options` | `nosniff` |
| `/blog-raw/*` | `X-Frame-Options` | `SAMEORIGIN` |
| `*` | `Content-Encoding` | gzip / zstd |

---

## 6. Архитектура Dashboard UI

### 6.1 Модульная структура JavaScript

```mermaid
flowchart TB
    HTML["index.html"]
    HTML --> UTILS["core/utils.js<br/>uid, escHtml, todayStr, showToast"]
    HTML --> WM["core/widget-manager.js<br/>WidgetRegistry, registerWidget<br/>visibility, reorder, settings<br/>loadWidgetConfig, applyWidgetConfig"]
    HTML --> DATA["data/go-data.js<br/>data/training-data.js"]
    HTML --> WIDGETS["widgets/*.js (17 файлов)<br/>Каждый вызывает registerWidget()"]
    HTML --> WCFG["widgets/widgets-config.json<br/>label, zone, storageKeys, defaults"]
    HTML --> CORE["core/projects.js, clock-notif.js<br/>zen-mode.js, keyboard.js<br/>briefing.js, export-import.js"]
    HTML --> APP["app.js<br/>roundRect polyfill"]
    HTML --> AUTH_JS["auth.js<br/>checkAuth, login, register<br/>initAuth → rerenderAllWidgets"]
    HTML --> WOD["word-of-day.js<br/>fetchWordData, translate, archive"]
    HTML --> INIT["initAuth()"]

    WIDGETS -->|"registerWidget({id, render, init})"| WM
    WM -->|"fetch"| WCFG
    WM -->|"applyWidgetConfig()<br/>merge label, zone, storageKeys"| WM
    WM -->|"localStorage"| LS[("localStorage<br/>~30 ключей")]
    AUTH_JS -->|"fetch /api/auth/*"| AUTH_API["Auth Gateway API"]
    WOD -->|"fetch"| DICT_API["Dictionary API"]
    WOD -->|"fetch"| TRANS_API["MyMemory API"]
```

### 6.2 Порядок инициализации

Порядок `<script>` тегов:
1. `core/utils.js` → `core/widget-manager.js` (всегда первые)
2. `data/*.js` (данные)
3. `widgets/*.js` (каждый вызывает `registerWidget()` при загрузке)
4. `core/projects.js`, `core/clock-notif.js`, `core/zen-mode.js`, `core/keyboard.js`, `core/briefing.js`, `core/export-import.js`
5. `app.js` → `auth.js` → `word-of-day.js` → `initAuth()`

```mermaid
sequenceDiagram
    participant B as Browser
    participant WM as widget-manager.js
    participant W as widgets/*.js
    participant WCFG as widgets-config.json
    participant A as auth.js
    participant WOD as word-of-day.js

    B->>WM: load (WidgetRegistry = [])
    B->>W: load widgets (registerWidget({id, render, init}) × 17)
    B->>A: load auth.js
    B->>WOD: load word-of-day.js
    B->>A: initAuth()

    A->>A: renderAuthForm()
    A->>A: checkAuth() → GET /api/auth/me
    alt Авторизован
        A->>A: hideAuthOverlay()
        A->>A: renderUserBadge()
        A->>A: applyDefaultsIfNewUser()
        A->>WM: loadDefaults() + loadWidgetConfig()
        WM->>WCFG: fetch widgets-config.json
        WCFG-->>WM: [{id, label, zone, storageKeys, defaults}]
        A->>WM: applyWidgetConfig() → merge into WidgetRegistry
        A->>WM: applyWidgetVisibility()
        A->>WM: rerenderAllWidgets() → каждый w.render()
        A->>WM: initAllWidgets() → каждый w.init()
    else Не авторизован
        A->>A: showAuthOverlay()
    end

    WOD->>WOD: DOMContentLoaded → initWordOfDay()
```

### 6.3 Компоненты Dashboard

```mermaid
mindmap
  root((Dashboard))
    Header
      Notifications toggle
      Focus mode (F)
      Day off toggle (O)
      Live Clock
      User Badge + Logout
    Projects Nav
      Auth Admin
      Gladys Blog
      Job Statistics
      Status: online/offline/checking
    Personal Bar
      Days Counter
        Edit date
        Reset + fail badges
      Financial Cushions
        +/- controls
      Mortgage Widget
        Payment, debt, rate
        Dates, payday
        Edit panel
    Running Progress
      Training Plan Target
        Phase / Week / Progress bar
        Today workout
        Week schedule
      5K / 10K / Half / Marathon
      Best time + pace
      History + edit
      Add result form
    Word of Day
      Dictionary API
      Translation
      Examples (editable)
      Archive (90 days)
    Schedule
      15 time slots
      Active slot highlight
      Notifications
    TODO
      Add / Complete / Delete
      Drag & Drop reorder
      Rename inline
      Current task marker
      Carry-over badges
      History panel
    Sticker Board
      Add / Edit / Delete
      Check off (strikethrough)
      Color picker per sticker
      No stats tracking
    Weekend Plan
      Day off toggle (O)
      Hides TODO + Productivity
      Add / Edit / Delete / Reorder
      Check off (no stats)
      Fullscreen mode
    Key Skills
      Select from Jobs API
      Category color coding
      Link to Jobs skill page
      localStorage persistence
    Monthly Goals
      Add / Edit / Delete
      Auto carry-over
      Recurring goals (early start)
      Progress bar + %
      Archive by month
    Yearly Goals
      Add / Edit / Delete
      Auto carry-over
      Progress bar + %
      Archive by year
    Productivity Stats
      Today: ring chart + metrics
      Streak days
      Week/Month/Year chart (canvas)
      Day detail on click
    Stats
      Go scripts counter
      Tasks counter
      Duolingo misses
      Early Start tracker (7:00–8:00)
    Reading List
      10 books tracker
      Status: waiting/reading/done
      Page tracking
      Progress bar
      Expandable sub-items (сборники/трилогии)
    Targets (Цели с планом)
      Add / Edit / Delete / Reorder
      Nested steps CRUD (вложенный план)
      Edit mode toggle
      Per-target progress bar + steps counter
      Celebration overlay при выполнении всех шагов
      Expand / collapse шагов
    Assembla Tickets
      Proxy через localhost:3131 (assembla-viewer)
      Список тикетов с фильтром статус / репорт / сортировка
      Детальный просмотр тикета + комментарии
      Смена статуса через PUT API
      Добавление комментариев
      Настройки: apiKey, apiSecret, spaceId (в localStorage)
    Server Build
      Editable components table (CRUD)
      Status workflow (выбираю → выбрано → в корзине → заказано → куплено)
      Compatible Ollama models table (CRUD)
      Auto-calculated total price
    AI Assistant
      Ollama integration (configurable URL + model)
      Voice input (Web Speech API, ru-RU)
      Text input with auto-resize
      Auto-context from localStorage
      Markdown rendering
      Chat history (last 10 messages)
      Connection status indicator
    Quote Banner
      Hourly rotation
      Shuffle
      Countdown
    Footer
      Export / Import data
```

### 6.4 Адаптивный дизайн (Responsive)

**Принцип:** страница никогда не имеет горизонтального скролла (`body`, `#main-content` — `overflow-x: hidden`). Каждый отдельный виджет при необходимости показывает собственный горизонтальный скролл (`.card, .widget, .stat` — `overflow-x: auto; min-width: 0`).

**Breakpoints:**
| Breakpoint | Назначение |
|-----------|------------|
| `≤ 900px` | Сетка → 1 колонка, уменьшенные отступы, Go-табы со скроллом |
| `≤ 700px` | Навигация проектов: скрыты описания, горизонтальный скролл |
| `≤ 500px` | Карточки: меньше padding/border-radius, footer компактнее |
| `≤ 480px` | Мобильный: все виджеты адаптированы (компактные шрифты, flex-wrap, видимые действия на touch) |

**Overflow containment** (full-width секции):
- `.running-section` — `overflow: hidden`
- `.wod-section` — `overflow: hidden`
- `#quote-banner` — `overflow: hidden`
- `.personal-bar, footer` — `overflow: hidden; min-width: 0`
- `.full-width` — `min-width: 0`

**CSS-файлы:**
- `css/core.css` — глобальные overflow-правила, grid responsive, header/footer mobile
- `css/panels.css` — навигация проектов (горизонтальный скролл), модалки, auth-card responsive
- `css/widgets/*.css` — каждый виджет имеет свои `@media (max-width: 480px)` правила

### 6.5 Хранилище данных (localStorage)

| Ключ | Тип | Описание |
|------|-----|----------|
| `prod_days_v1` | `{startDate, failCount}` | Счётчик дней без привычки |
| `prod_cushions` | `number` | Финансовые подушки |
| `prod_mortgage_v1` | `{payment, debt, rate, ...}` | Ипотека |
| `prod_notif_enabled` | `"0"\|"1"` | Уведомления вкл/выкл |
| `prod_zen_mode` | `"0"\|"1"` | Фокус-режим вкл/выкл |
| `prod_day_off` | `"0"\|"1"` | Режим выходного дня вкл/выкл |
| `prod_tasks_v1` | `[{id, text, done, current, ...}]` | Задачи |
| `prod_history_v1` | `[{id, text, addedAt, doneAt, workedMs}]` | История задач |
| `prod_stickers_v1` | `[{id, text, done, color, createdAt}]` | Доска напоминаний (стикеры) |
| `prod_weekend_tasks_v1` | `[{id, text, done}]` | План выходного дня (только Сб/Вс) |
| `prod_monthly_goals_v2` | `{monthKey: [{id, text, icon, done, recurring?, carriedFrom?}]}` | Цели на месяц (по ключу YYYY-MM) |
| `prod_yearly_goals_v2` | `{yearKey: [{id, text, icon, done, recurring?, carriedFrom?}]}` | Цели на год (по ключу YYYY) |
| `prod_daily_snapshot_v1` | `{dateStr: {completed, remaining, totalMs, ...}}` | Снимки продуктивности по дням |
| `prod_early_start_v1` | `{monthKey: {dateStr: {time, success}}}` | Трекер раннего старта 7:00–8:00 |
| `prod_stat_go` | `number` | Счётчик Go-скриптов |
| `prod_stat_tasks` | `number` | Счётчик рабочих задач |
| `prod_stat_duo` | `number` | Пропуски Duolingo |
| `prod_schedule_labels_v1` | `{index: {label, sub}}` | Пользовательские названия окон расписания |
| `prod_reading_books_v1` | `[{id, title, author, type, subItems?}]` | Список книг для чтения (пользовательский) |
| `prod_reading_v1` | `{bookId: {status, page, startedAt}}` | Прогресс чтения (включая sub-items сборников/трилогий) |
| `prod_assembla_config_v1` | `{apiKey, apiSecret, spaceId}` | Конфиг Assembla виджета (ключи API, ID пространства) |
| `prod_targets_v1` | `[{id, title, createdAt}]` | Цели с пошаговым планом (CRUD) |
| `prod_target_steps_v1` | `{targetId: [{id, title, done, createdAt}]}` | Шаги для каждой цели (вложенный CRUD) |
| `prod_running_v1` | `{distId: [{secs, date, addedAt}]}` | Результаты бега |
| `prod_wod_cache` | `{word, wordRu, ...}` | Кэш слова дня |
| `prod_wod_archive_v1` | `[{word, date, ...}]` | Архив слов (90 дней) |
| `prod_scratchpad_v1` | `{text, date, history: {date: text}}` | Быстрые заметки с историей по дням |
| `prod_distractions_v1` | `{dateStr: [{category, time}]}` | Лог отвлечений по дням |
| `prod_briefing_dismissed` | `"YYYY-MM-DD"` | Дата закрытия утреннего брифинга |
| `prod_retrospective_v1` | `{weekKey: {stats, note, createdAt}}` | Еженедельные ретроспективы |
| `prod_go_lessons_v1` | `{lessonId: {done, doneAt}}` | Прогресс уроков Syncthing |
| `prod_go_tour_v1` | `{exerciseId: {done, doneAt}}` | Прогресс Go Tour упражнений |
| `prod_go_code_v1` | `{itemId: {done, doneAt}}` | Прогресс изучения кода |
| `prod_go_start_date` | `"YYYY-MM-DD"` | Дата начала Go уроков |
| `prod_key_skills_v1` | `[{id, name, category}]` | Ключевые навыки (связь с Jobs) |
| `prod_ai_history_v1` | `[{role, content, timestamp}]` | История чата AI ассистента |
| `prod_server_build_v1` | `[{id, component, model, price, link, status}]` | Компоненты серверной сборки (CRUD) |
| `prod_server_models_v1` | `[{id, name, size, vram, speed, quality}]` | Совместимые модели Ollama (CRUD) |
| `prod_ai_ollama_url` | `string` | URL Ollama сервера (default: `http://localhost:11434`) |
| `prod_ai_model` | `string` | Модель Ollama (default: `gemma3:4b`) |

---

## 7. Аутентификация

### 7.1 Поток авторизации Dashboard

```mermaid
sequenceDiagram
    actor U as Пользователь
    participant D as Dashboard
    participant GW as Caddy Gateway
    participant A as Auth Gateway

    U->>GW: GET /
    GW->>D: Отдать index.html
    D->>D: initAuth()
    D->>GW: GET /api/auth/me (credentials: include)
    GW->>A: proxy
    alt Cookie auth_token присутствует
        A-->>D: 200 {id, username, email, role}
        D->>D: hideAuthOverlay()
        D->>D: renderUserBadge()
    else Нет cookie или невалидный
        A-->>D: 401
        D->>D: showAuthOverlay()
        Note over U,D: Пользователь видит форму входа
    end
```

### 7.2 RBAC в контексте платформы

```mermaid
flowchart TB
    subgraph Roles["Роли"]
        ADMIN["admin"]
        USER["user"]
    end

    subgraph Access["Доступ"]
        DASHBOARD["Dashboard UI"]
        PROJECTS["Проекты (Blog, Jobs)"]
        ADMIN_PANEL["Admin Panel"]
        DATA_EXPORT["Экспорт/Импорт данных"]
    end

    USER --> DASHBOARD
    USER --> PROJECTS
    USER --> DATA_EXPORT

    ADMIN --> DASHBOARD
    ADMIN --> PROJECTS
    ADMIN --> DATA_EXPORT
    ADMIN --> ADMIN_PANEL
```

---

## 8. Docker Compose — оркестрация

### 8.1 Сервисы

```mermaid
flowchart TB
    subgraph Core["Core (всегда запущены)"]
        GW["gateway<br/>caddy:2-alpine<br/>:80, :443"]
        DASH["dashboard<br/>caddy:2-alpine<br/>:80 internal"]
        AUTH["auth-gateway<br/>Build: Auth-Gateway/backend<br/>:8080"]
        AUTH_UI["auth-admin<br/>Build: Auth-Gateway/frontend<br/>:80 internal"]
        AUTH_DB["auth-db<br/>mysql:8.0<br/>:3306 internal"]
    end

    subgraph Blog["Profile: blog"]
        BLOG_SVC["gladys-blog<br/>Build: Gladys-Blog<br/>:443 internal"]
    end

    subgraph Jobs["Profile: jobs"]
        JOBS_FE["job-stats-frontend<br/>Build: job-statistics/frontend<br/>:3000 internal"]
        JOBS_API["job-stats-api<br/>Build: job-statistics/backend<br/>:8081"]
        JOBS_DB["job-stats-db<br/>mysql:8.0<br/>:3306 internal"]
    end

    GW -.->|depends_on| AUTH
    GW -.->|depends_on| DASH
    AUTH -.->|depends_on<br/>service_healthy| AUTH_DB
    JOBS_API -.->|depends_on<br/>service_healthy| JOBS_DB

    style Core fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style Blog fill:#2d2640,stroke:#a78bfa,color:#e2e8f0
    style Jobs fill:#2a2510,stroke:#f59e0b,color:#e2e8f0
```

### 8.2 Профили Docker Compose

| Профиль | Сервисы | Команда |
|---------|---------|---------|
| (default) | gateway, dashboard, auth-gateway, auth-admin, auth-db | `make up` |
| `blog` | + gladys-blog, blog-admin | `make up-blog` |
| `jobs` | + job-stats-frontend, job-stats-api, job-stats-db | `make up-jobs` |
| `blog` + `jobs` | Все сервисы | `make up-all` |

### 8.3 Volumes

| Volume | Тип | Контейнер | Mount |
|--------|-----|-----------|-------|
| `caddy_data` | Named | gateway | /data |
| `caddy_config` | Named | gateway | /config |
| `auth_data` | Named | auth-db | /var/lib/mysql |
| `jobs_data` | External | job-stats-db | /var/lib/mysql |
| `blog_content` | Named | blog-admin | /blog |
| `blog_public` | Named | blog-admin (rw), gladys-blog (ro) | /blog/public, /usr/share/nginx/html |
| `./www` | Bind (ro) | gateway, dashboard | /srv/www |
| `./Caddyfile` | Bind (ro) | gateway | /etc/caddy/Caddyfile |

---

## 9. Интеграция подпроектов

### 9.1 Как подпроект интегрируется в платформу

```mermaid
flowchart LR
    subgraph Project["Новый проект"]
        SRC["Исходный код"]
        DOCK["Dockerfile"]
    end

    subgraph Platform["Productivity Platform"]
        COMPOSE["docker-compose.yaml<br/>+ service + network"]
        CADDY["Caddyfile<br/>+ handle /path/*"]
        APP_JS["app.js<br/>+ PROJECTS entry"]
    end

    SRC --> DOCK
    DOCK --> COMPOSE
    COMPOSE --> CADDY
    CADDY --> APP_JS
```

### 9.2 Чеклист добавления проекта

1. **Docker Compose:** добавить сервис, подключить к `gateway` network, указать profile
2. **Caddyfile:** добавить `handle /path/*` с `route { forward_auth + handle_response @unauthed + header_regexp permission check + 403 fallback }`
3. **Dashboard `app.js`:** добавить объект в `PROJECTS` и permission в `PROJECT_PERMISSIONS`
4. **API URL:** в подпроекте реализовать определение `basename` / API URL по `window.location.pathname`

### 9.3 Паттерн обнаружения Gateway-режима

Каждый подпроект проверяет, запущен ли он через Gateway:

```javascript
// Job Statistics (React)
const basename = window.location.pathname.startsWith('/jobs') ? '/jobs' : '/';
const API_BASE = basename === '/jobs' ? '/jobs/api/v1' : 'http://localhost:8081/api/v1';

// Admin Panel (Vanilla JS)
function isGatewayMode() {
  return window.location.pathname.startsWith('/admin');
}
```

---

## 10. Контроль доступа к проектам (Caddy-level)

Caddy проверяет доступ на уровне Gateway через `forward_auth` + `header_regexp X-Auth-Permissions`:

```mermaid
flowchart TB
    REQ["GET /jobs/"] --> FA["forward_auth<br/>/api/auth/verify"]

    FA -->|"401 (нет JWT)"| REDIR["handle_response:<br/>redir /?redirect=/jobs/"]
    FA -->|"200 + headers"| CHECK["header_regexp<br/>X-Auth-Permissions"]

    CHECK -->|"содержит 'jobs'"| PROXY["reverse_proxy<br/>job-stats-frontend:3000"]
    CHECK -->|"не содержит"| DENY["file_server<br/>/403.html"]

    REDIR --> DASH["Dashboard<br/>форма входа/регистрации"]
    DASH -->|"после логина"| REQ
```

| Маршрут | Permission | Действие при наличии | Действие при отсутствии |
|---------|-----------|---------------------|----------------------|
| `/admin/*` | `admin` | reverse_proxy auth-admin:80 | 403.html |
| `/blog/` | `blog` | serve blog-wrapper.html | 403.html |
| `/jobs/*` | `jobs` | reverse_proxy job-stats-frontend:3000 | 403.html |
| `/chat/*` | `chat` | reverse_proxy gladys-chat-frontend:80 | 403.html |

**Блог — исключение:** использует iframe-обёртку (`blog-wrapper.html`), т.к. Hugo не поддерживает навигацию "← Dashboard". Остальные проекты (React/Go SPA) проксируются напрямую.

**Регистрация:** единая через Auth Gateway. После `/?redirect={path}` Dashboard показывает форму входа/регистрации, после успешной авторизации — redirect обратно на проект. Все пользователи доступны в админке.

### Связь downstream-проектов с Auth DB

| Проект | Связь с Auth DB | Описание |
|--------|----------------|----------|
| **Gladys Chat** | `users.auth_user_id` → Auth `users.id` | Каждый чат уникален для пользователя |
| **Job Statistics** | `users.auth_user_id` → Auth `users.id` | Вакансии привязаны к пользователю через `jobs.user_id` |
| **Gladys Blog** | Не требуется | Статический контент, доступ через `forward_auth` |

### RBAC в Job Statistics

| Сущность | GET | POST/PUT/DELETE |
|----------|-----|----------------|
| **Companies, Skills, Locations** | Все пользователи | Только админ (справочные данные) |
| **Jobs** | Админ — все, user — только свои | Админ — любые, user — только свои |
| **Stats** | Все пользователи | — (read-only) |

При удалении пользователя (Auth Gateway soft delete) вакансии остаются с `user_id = NULL` (ON DELETE SET NULL) — видны только админу.

---

## 11. Внешние API

| API | Использование | Файл |
|-----|--------------|------|
| `api.dictionaryapi.dev` | Определения слов (en) | word-of-day.js |
| `api.mymemory.translated.net` | Перевод en→ru | word-of-day.js |
| Ollama `/api/chat` | AI ассистент (LLM inference) | app.js |

---

## 12. Проверка доступности проектов

```mermaid
sequenceDiagram
    participant D as Dashboard
    participant GW as Caddy Gateway

    loop Каждые 30 сек
        D->>GW: fetch('/admin/', {timeout: 4s})
        alt 200 или 401
            D->>D: status = 'online'
        else Timeout / Error
            D->>D: status = 'offline'
        end

        D->>GW: fetch('/blog/', {timeout: 4s})
        D->>GW: fetch('/jobs/', {timeout: 4s})
    end

    Note over D: Индикаторы: 🟢 online / 🔴 offline / ⚪ checking
```

---

## 13. Makefile — команды управления

```makefile
up              # Core: Dashboard + Auth Gateway
down            # Stop all services (all profiles)
restart         # Restart core
logs            # Follow logs (all profiles)
up-all          # ALL: core + blog + jobs + chat + sketchbook
up-blog         # Core + Gladys Blog
up-jobs         # Core + Job Statistics
up-chat         # Core + Gladys Chat
up-sketchbook   # Core + Sketchbook
quotes          # Parse quotes from markdown → quotes.json
open            # Open Dashboard in browser
build-auth      # Rebuild Auth Gateway containers
clean           # Remove all volumes and containers
status          # Show status of all services

# Job Statistics: сборка и тесты
jobs-rebuild           # Пересобрать API + Frontend (без кэша)
jobs-rebuild-api       # Пересобрать только API
jobs-rebuild-frontend  # Пересобрать только Frontend
jobs-logs              # Логи Job Statistics
jobs-test-backend      # Unit-тесты Go backend (локально)
jobs-test              # Jest тесты фронтенда (Docker)
jobs-test-coverage     # Jest тесты + покрытие
jobs-lint              # ESLint проверка
jobs-lint-fix          # ESLint с авто-исправлением
jobs-migrate           # Применить миграции БД
jobs-seed              # Загрузить тестовые данные (DESTRUCTIVE)

# Gladys Chat: сборка
chat-rebuild           # Пересобрать API + Frontend (без кэша)
chat-rebuild-api       # Пересобрать только API
chat-rebuild-frontend  # Пересобрать только Frontend
chat-logs              # Логи Gladys Chat
chat-migrate           # Применить миграции БД
```

---

## 14. Диаграмма зависимостей между проектами

```mermaid
flowchart TB
    PROD["Productivity<br/>(оркестратор)"]

    ECON["Auth-Gateway<br/>(Auth Gateway)"]
    BLOG["Gladys-Blog"]
    JOBS["job-statistics-platform"]

    PROD -->|"build + network + routing"| ECON
    PROD -->|"build + routing + iframe"| BLOG
    PROD -->|"build + routing + volume"| JOBS

    ECON -->|"JWT cookie"| PROD
    PROD -->|"credentials: include"| ECON

    JOBS -.->|"external volume"| JOBS_VOL[("job-statistics-platform_mysql_data")]

    style PROD fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style ECON fill:#3b1f2b,stroke:#ef4444,color:#e2e8f0
    style BLOG fill:#2d2640,stroke:#a78bfa,color:#e2e8f0
    style JOBS fill:#2a2510,stroke:#f59e0b,color:#e2e8f0
```

**Ключевые связи:**
- **Productivity → Auth-Gateway:** JWT-аутентификация через HttpOnly cookie
- **Productivity → Gladys-Blog:** iframe + TLS-проксирование (skip verify)
- **Productivity → job-statistics-platform:** URI strip prefix, external volume для сохранения данных
- **Все подпроекты → Productivity:** Обнаружение gateway-режима по `window.location.pathname`
