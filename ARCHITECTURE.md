# ARCHITECTURE.md — Gladys Dashboard (Unified Platform)

> A unified hub platform for managing local Docker projects with centralized authentication, a productivity dashboard, and sub-project integration.

---

## 1. System Overview

Gladys Dashboard is an orchestrating project that unites several independent applications under a single reverse proxy (Caddy), provides centralized authentication, and offers a personal productivity dashboard.

**Role:** API Gateway + Dashboard UI + Infrastructure as Code
**Stack:** Caddy 2 (Gateway) · Vanilla JS (Dashboard) · Docker Compose · Make

---

## 2. System Diagram (C4 — System Context)

```mermaid
flowchart TB
    USER((User))

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

## 3. Project Structure

```
Productivity/
├── docker-compose.yaml       # Unified orchestration of all services
├── Caddyfile                 # Gateway: routing + headers + encoding
├── DashboardCaddyfile        # Internal static server for Dashboard
├── Makefile                  # Management commands: up, down, up-all, logs, status
├── .env                      # Secrets: JWT_SECRET, DB credentials
├── .env.example              # Environment variables template
├── www/                      # Dashboard static files
│   ├── index.html            # SPA: auth overlay + main content
│   ├── blog-wrapper.html     # iframe wrapper for blog (Hugo doesn't support nav)
│   ├── 403.html              # 403 page — no access rights to project
│   ├── css/
│   │   ├── core.css          # Variables, animations, grid, header, footer, responsive
│   │   ├── panels.css        # Modals, widget settings, admin
│   │   └── widgets/          # Styles for each widget (per file)
│   │       ├── quote.css … ai-assistant.css
│   │       └── server-build.css
│   ├── js/
│   │   ├── core/
│   │   │   ├── utils.js          # uid(), escHtml(), todayStr(), fmtDate(), showToast()
│   │   │   ├── widget-manager.js # WidgetRegistry, registerWidget(), visibility, reorder
│   │   │   ├── projects.js       # Project navigation
│   │   │   ├── clock-notif.js    # Clock + notifications
│   │   │   ├── zen-mode.js       # Zen mode, day-off, scroll arrows
│   │   │   ├── keyboard.js       # Hotkeys
│   │   │   ├── briefing.js       # Morning briefing + retrospective
│   │   │   └── export-import.js  # exportData(), importData()
│   │   ├── widgets/              # Each widget is a separate file with registerWidget()
│   │   │   ├── quote.js          personal-bar.js    running.js
│   │   │   ├── schedule.js       todo.js            stickers.js
│   │   │   ├── weekend-plan.js   principles.js      key-skills.js
│   │   │   ├── goals.js          stats.js           reading.js
│   │   │   ├── productivity.js   go-roadmap.js      scratchpad.js
│   │   │   ├── server-build.js   ai-assistant.js
│   │   │   └── (each calls registerWidget() at the end)
│   │   ├── data/
│   │   │   ├── go-data.js        # Go lessons data
│   │   │   └── training-data.js  # CSV loader: training plan + records
│   │   ├── app.js            # Thin orchestrator (roundRect polyfill)
│   │   ├── auth.js           # Authentication: login, register, verify
│   │   └── word-of-day.js    # Word of the day: API + cache + archive
│   ├── data/
│   │   ├── words.json              # Dictionary for "Word of the Day"
│   │   ├── dashboard-data-default.json  # Default data for new users
│   │   ├── training_schedule.csv   # → symlink / docker mount from 5run
│   │   └── records_sorted.csv     # → symlink / docker mount from 5run
│   └── quotes.json           # Quotes (generated from markdown)
├── tests/                    # Dashboard UI Jest tests
│   ├── Dockerfile            # Docker container for tests
│   ├── package.json          # Jest + jsdom dependencies
│   ├── jest.config.js        # Jest configuration
│   └── src/                  # Tests
│       ├── setup.js          # Global mocks (fetch, AudioContext, confirm)
│       ├── helpers.js        # Dashboard JS loader for jsdom
│       ├── core/             # Core module tests
│       └── widgets/          # Widget tests (CRUD, render, registration)
├── scripts/
│   └── parse_quotes.py       # Quotes parser
├── docs/
│   ├── auth-architecture.md  # Auth architecture documentation
│   ├── widget-guide.md       # Guide for creating a new widget
│   ├── project-registration-guide.md  # Guide for registering projects
│   └── new-project-guide.md  # Guide for creating a new project
└── CLAUDE.md                 # Instructions for AI assistant
```

---

## 4. Network Architecture

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

### 4.2 Network Isolation

| Network | Participants | Purpose |
|------|-----------|-----------|
| `gateway` | All services + Caddy | HTTP traffic routing |
| `auth-internal` | Auth Gateway + Auth DB | Isolation of authentication DB |
| `jobs-internal` | Job Stats API + Jobs DB | Isolation of jobs DB |

**Principle:** Databases are accessible only from their respective internal networks. The gateway network provides connectivity between frontends and APIs via Caddy.

---

## 5. Caddy Gateway — Routing

### 5.1 Routing Table

```
:80 {
    /api/auth/*          → auth-gateway:8080     (public, no forward_auth)
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

Access control at Caddy level (forward_auth + header_regexp X-Auth-Permissions):
- 401 (no JWT) → redirect to /?redirect={path} → Dashboard shows login/register form
- No permission → Caddy returns /srv/www/403.html (static page)
```

### 5.2 Routing Diagram

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

| Path | Header | Value |
|------|--------|---------|
| `*` | `X-Content-Type-Options` | `nosniff` |
| `/blog-raw/*` | `X-Frame-Options` | `SAMEORIGIN` |
| `*` | `Content-Encoding` | gzip / zstd |

---

## 6. Dashboard UI Architecture

### 6.1 Modular JavaScript Structure

```mermaid
flowchart TB
    HTML["index.html"]
    HTML --> UTILS["core/utils.js<br/>uid, escHtml, todayStr, showToast"]
    HTML --> WM["core/widget-manager.js<br/>WidgetRegistry, registerWidget<br/>visibility, reorder, settings<br/>loadWidgetConfig, applyWidgetConfig"]
    HTML --> DATA["data/go-data.js<br/>data/training-data.js"]
    HTML --> WIDGETS["widgets/*.js (17 files)<br/>Each calls registerWidget()"]
    HTML --> WCFG["widgets/widgets-config.json<br/>label, zone, storageKeys, defaults"]
    HTML --> CORE["core/projects.js, clock-notif.js<br/>zen-mode.js, keyboard.js<br/>briefing.js, export-import.js"]
    HTML --> APP["app.js<br/>roundRect polyfill"]
    HTML --> AUTH_JS["auth.js<br/>checkAuth, login, register<br/>initAuth → rerenderAllWidgets"]
    HTML --> WOD["word-of-day.js<br/>fetchWordData, translate, archive"]
    HTML --> INIT["initAuth()"]

    WIDGETS -->|"registerWidget({id, render, init})"| WM
    WM -->|"fetch"| WCFG
    WM -->|"applyWidgetConfig()<br/>merge label, zone, storageKeys"| WM
    WM -->|"localStorage"| LS[("localStorage<br/>~30 keys")]
    AUTH_JS -->|"fetch /api/auth/*"| AUTH_API["Auth Gateway API"]
    WOD -->|"fetch"| DICT_API["Dictionary API"]
    WOD -->|"fetch"| TRANS_API["MyMemory API"]
```

### 6.2 Initialization Order

`<script>` tag order:
1. `core/utils.js` → `core/widget-manager.js` (always first)
2. `data/*.js` (data)
3. `widgets/*.js` (each calls `registerWidget()` on load)
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
    alt Authorized
        A->>A: hideAuthOverlay()
        A->>A: renderUserBadge()
        A->>A: applyDefaultsIfNewUser()
        A->>WM: loadDefaults() + loadWidgetConfig()
        WM->>WCFG: fetch widgets-config.json
        WCFG-->>WM: [{id, label, zone, storageKeys, defaults}]
        A->>WM: applyWidgetConfig() → merge into WidgetRegistry
        A->>WM: applyWidgetVisibility()
        A->>WM: rerenderAllWidgets() → each w.render()
        A->>WM: initAllWidgets() → each w.init()
    else Not Authorized
        A->>A: showAuthOverlay()
    end

    WOD->>WOD: DOMContentLoaded → initWordOfDay()
```

### 6.3 Dashboard Components

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
      Expandable sub-items (collections/trilogies)
    Targets (Goals with plan)
      Add / Edit / Delete / Reorder
      Nested steps CRUD (nested plan)
      Edit mode toggle
      Per-target progress bar + steps counter
      Celebration overlay upon completing all steps
      Expand / collapse steps
    Assembla Tickets
      Proxy via localhost:3131 (assembla-viewer)
      Ticket list with filter status / report / sort
      Detailed ticket view + comments
      Status change via PUT API
      Add comments
      Settings: apiKey, apiSecret, spaceId (in localStorage)
    Server Build
      Editable components table (CRUD)
      Status workflow (select → selected → in cart → ordered → bought)
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

### 6.4 Responsive Design

**Principle:** The page never has horizontal scroll (`body`, `#main-content` — `overflow-x: hidden`). Each individual widget shows its own horizontal scroll if necessary (`.card, .widget, .stat` — `overflow-x: auto; min-width: 0`).

**Breakpoints:**
| Breakpoint | Purpose |
|-----------|------------|
| `≤ 900px` | Grid → 1 column, reduced margins, Go tabs with scroll |
| `≤ 700px` | Projects nav: descriptions hidden, horizontal scroll |
| `≤ 500px` | Cards: smaller padding/border-radius, compact footer |
| `≤ 480px` | Mobile: all widgets adapted (compact fonts, flex-wrap, touch-friendly actions) |

**Overflow containment** (full-width sections):
- `.running-section` — `overflow: hidden`
- `.wod-section` — `overflow: hidden`
- `#quote-banner` — `overflow: hidden`
- `.personal-bar, footer` — `overflow: hidden; min-width: 0`
- `.full-width` — `min-width: 0`

**CSS files:**
- `css/core.css` — global overflow rules, responsive grid, mobile header/footer
- `css/panels.css` — projects nav (horizontal scroll), modals, responsive auth-card
- `css/widgets/*.css` — each widget has its own `@media (max-width: 480px)` rules

### 6.5 Data Storage (localStorage)

| Key | Type | Description |
|------|-----|----------|
| `prod_days_v1` | `{startDate, failCount}` | Days counter without habit |
| `prod_cushions` | `number` | Financial cushions |
| `prod_mortgage_v1` | `{payment, debt, rate, ...}` | Mortgage |
| `prod_notif_enabled` | `"0"\|"1"` | Notifications on/off |
| `prod_zen_mode` | `"0"\|"1"` | Focus mode on/off |
| `prod_day_off` | `"0"\|"1"` | Day off mode on/off |
| `prod_tasks_v1` | `[{id, text, done, current, ...}]` | Tasks |
| `prod_history_v1` | `[{id, text, addedAt, doneAt, workedMs}]` | Task history |
| `prod_stickers_v1` | `[{id, text, done, color, createdAt}]` | Reminder board (stickers) |
| `prod_weekend_tasks_v1` | `[{id, text, done}]` | Weekend plan (Sat/Sun only) |
| `prod_monthly_goals_v2` | `{monthKey: [{id, text, icon, done, recurring?, carriedFrom?}]}` | Monthly goals (by YYYY-MM key) |
| `prod_yearly_goals_v2` | `{yearKey: [{id, text, icon, done, recurring?, carriedFrom?}]}` | Yearly goals (by YYYY key) |
| `prod_daily_snapshot_v1` | `{dateStr: {completed, remaining, totalMs, ...}}` | Daily productivity snapshots |
| `prod_early_start_v1` | `{monthKey: {dateStr: {time, success}}}` | Early start tracker 7:00–8:00 |
| `prod_stat_go` | `number` | Go scripts counter |
| `prod_stat_tasks` | `number` | Work tasks counter |
| `prod_stat_duo` | `number` | Duolingo misses |
| `prod_schedule_labels_v1` | `{index: {label, sub}}` | Custom schedule slot names |
| `prod_reading_books_v1` | `[{id, title, author, type, subItems?}]` | User reading list |
| `prod_reading_v1` | `{bookId: {status, page, startedAt}}` | Reading progress (including sub-items of collections/trilogies) |
| `prod_assembla_config_v1` | `{apiKey, apiSecret, spaceId}` | Assembla widget config (API keys, space ID) |
| `prod_targets_v1` | `[{id, title, createdAt}]` | Goals with step-by-step plan (CRUD) |
| `prod_target_steps_v1` | `{targetId: [{id, title, done, createdAt}]}` | Steps for each goal (nested CRUD) |
| `prod_running_v1` | `{distId: [{secs, date, addedAt}]}` | Running results |
| `prod_wod_cache` | `{word, wordRu, ...}` | Word of the day cache |
| `prod_wod_archive_v1` | `[{word, date, ...}]` | Word archive (90 days) |
| `prod_scratchpad_v1` | `{text, date, history: {date: text}}` | Quick notes with daily history |
| `prod_distractions_v1` | `{dateStr: [{category, time}]}` | Daily distraction log |
| `prod_briefing_dismissed` | `"YYYY-MM-DD"` | Date of morning briefing dismissal |
| `prod_retrospective_v1` | `{weekKey: {stats, note, createdAt}}` | Weekly retrospectives |
| `prod_go_lessons_v1` | `{lessonId: {done, doneAt}}` | Syncthing lessons progress |
| `prod_go_tour_v1` | `{exerciseId: {done, doneAt}}` | Go Tour exercises progress |
| `prod_go_code_v1` | `{itemId: {done, doneAt}}` | Code study progress |
| `prod_go_start_date` | `"YYYY-MM-DD"` | Go lessons start date |
| `prod_key_skills_v1` | `[{id, name, category}]` | Key skills (linked to Jobs) |
| `prod_ai_history_v1` | `[{role, content, timestamp}]` | AI assistant chat history |
| `prod_server_build_v1` | `[{id, component, model, price, link, status}]` | Server build components (CRUD) |
| `prod_server_models_v1` | `[{id, name, size, vram, speed, quality}]` | Compatible Ollama models (CRUD) |
| `prod_ai_ollama_url` | `string` | Ollama server URL (default: `http://localhost:11434`) |
| `prod_ai_model` | `string` | Ollama model (default: `gemma3:4b`) |

---

## 7. Authentication

### 7.1 Dashboard Authorization Flow

```mermaid
sequenceDiagram
    actor U as User
    participant D as Dashboard
    participant GW as Caddy Gateway
    participant A as Auth Gateway

    U->>GW: GET /
    GW->>D: Return index.html
    D->>D: initAuth()
    D->>GW: GET /api/auth/me (credentials: include)
    GW->>A: proxy
    alt auth_token cookie present
        A-->>D: 200 {id, username, email, role}
        D->>D: hideAuthOverlay()
        D->>D: renderUserBadge()
    else No cookie or invalid
        A-->>D: 401
        D->>D: showAuthOverlay()
        Note over U,D: User sees login form
    end
```

### 7.2 RBAC in Platform Context

```mermaid
flowchart TB
    subgraph Roles["Roles"]
        ADMIN["admin"]
        USER["user"]
    end

    subgraph Access["Access"]
        DASHBOARD["Dashboard UI"]
        PROJECTS["Projects (Blog, Jobs)"]
        ADMIN_PANEL["Admin Panel"]
        DATA_EXPORT["Data Export/Import"]
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

## 8. Docker Compose — Orchestration

### 8.1 Services

```mermaid
flowchart TB
    subgraph Core["Core (always running)"]
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

### 8.2 Docker Compose Profiles

| Profile | Services | Command |
|---------|---------|---------|
| (default) | gateway, dashboard, auth-gateway, auth-admin, auth-db | `make up` |
| `blog` | + gladys-blog, blog-admin | `make up-blog` |
| `jobs` | + job-stats-frontend, job-stats-api, job-stats-db | `make up-jobs` |
| `blog` + `jobs` | All services | `make up-all` |

### 8.3 Volumes

| Volume | Type | Container | Mount |
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

## 9. Sub-project Integration

### 9.1 How a sub-project integrates into the platform

```mermaid
flowchart LR
    subgraph Project["New Project"]
        SRC["Source Code"]
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

### 9.2 Project Addition Checklist

1. **Docker Compose:** add service, connect to `gateway` network, specify profile.
2. **Caddyfile:** add `handle /path/*` with `route { forward_auth + handle_response @unauthed + header_regexp permission check + 403 fallback }`.
3. **Dashboard `app.js`:** add object to `PROJECTS` and permission to `PROJECT_PERMISSIONS`.
4. **API URL:** in the sub-project, implement `basename` / API URL detection via `window.location.pathname`.

### 9.3 Gateway Mode Detection Pattern

Each sub-project checks if it is running via the Gateway:

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

## 10. Project Access Control (Caddy-level)

Caddy checks access at the Gateway level via `forward_auth` + `header_regexp X-Auth-Permissions`:

```mermaid
flowchart TB
    REQ["GET /jobs/"] --> FA["forward_auth<br/>/api/auth/verify"]

    FA -->|"401 (no JWT)"| REDIR["handle_response:<br/>redir /?redirect=/jobs/"]
    FA -->|"200 + headers"| CHECK["header_regexp<br/>X-Auth-Permissions"]

    CHECK -->|"contains 'jobs'"| PROXY["reverse_proxy<br/>job-stats-frontend:3000"]
    CHECK -->|"does not contain"| DENY["file_server<br/>/403.html"]

    REDIR --> DASH["Dashboard<br/>login form"]
    DASH -->|"after login"| REQ
```

| Route | Permission | Action if present | Action if absent |
|---------|-----------|---------------------|----------------------|
| `/admin/*` | `admin` | reverse_proxy auth-admin:80 | 403.html |
| `/blog/` | `blog` | serve blog-wrapper.html | 403.html |
| `/jobs/*` | `jobs` | reverse_proxy job-stats-frontend:3000 | 403.html |
| `/chat/*` | `chat` | reverse_proxy gladys-chat-frontend:80 | 403.html |

**Blog — Exception:** uses an iframe wrapper (`blog-wrapper.html`) because Hugo does not support "← Dashboard" navigation. Other projects (React/Go SPAs) are proxied directly.

**Registration:** unified via Auth Gateway. After `/?redirect={path}`, Dashboard shows login/register form, and after successful authorization, redirects back to the project. All users are available in the admin panel.

### Connection of downstream projects to Auth DB

| Project | Connection to Auth DB | Description |
|--------|----------------|----------|
| **Gladys Chat** | `users.auth_user_id` → Auth `users.id` | Each chat is unique to the user |
| **Job Statistics** | `users.auth_user_id` → Auth `users.id` | Vacancies linked to user via `jobs.user_id` |
| **Gladys Blog** | Not required | Static content, access via `forward_auth` |

### RBAC in Job Statistics

| Entity | GET | POST/PUT/DELETE |
|----------|-----|----------------|
| **Companies, Skills, Locations** | All users | Admin only (reference data) |
| **Jobs** | Admin — all, user — only their own | Admin — any, user — only their own |
| **Stats** | All users | — (read-only) |

When a user is deleted (Auth Gateway soft delete), vacancies remain with `user_id = NULL` (ON DELETE SET NULL) — visible only to the admin.

---

## 11. External APIs

| API | Usage | File |
|-----|--------------|------|
| `api.dictionaryapi.dev` | Word definitions (en) | word-of-day.js |
| `api.mymemory.translated.net` | Translation en→ru | word-of-day.js |
| Ollama `/api/chat` | AI assistant (LLM inference) | app.js |

---

## 12. Project Availability Check

```mermaid
sequenceDiagram
    participant D as Dashboard
    participant GW as Caddy Gateway

    loop Every 30 sec
        D->>GW: fetch('/admin/', {timeout: 4s})
        alt 200 or 401
            D->>D: status = 'online'
        else Timeout / Error
            D->>D: status = 'offline'
        end

        D->>GW: fetch('/blog/', {timeout: 4s})
        D->>GW: fetch('/jobs/', {timeout: 4s})
    end

    Note over D: Indicators: 🟢 online / 🔴 offline / ⚪ checking
```

---

## 13. Makefile — Management Commands

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

# Job Statistics: build and tests
jobs-rebuild           # Rebuild API + Frontend (no cache)
jobs-rebuild-api       # Rebuild API only
jobs-rebuild-frontend  # Rebuild Frontend only
jobs-logs              # Job Statistics logs
jobs-test-backend      # Go backend unit tests (local)
jobs-test              # Frontend Jest tests (Docker)
jobs-test-coverage     # Jest tests + coverage
jobs-lint              # ESLint check
jobs-lint-fix          # ESLint with auto-fix
jobs-migrate           # Apply DB migrations
jobs-seed              # Load test data (DESTRUCTIVE)

# Gladys Chat: build
chat-rebuild           # Rebuild API + Frontend (no cache)
chat-rebuild-api       # Rebuild API only
chat-rebuild-frontend  # Rebuild Frontend only
chat-logs              # Gladys Chat logs
chat-migrate           # Apply DB migrations
```

---

## 14. Project Dependency Diagram

```mermaid
flowchart TB
    PROD["Productivity<br/>(orchestrator)"]

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

**Key Connections:**
- **Productivity → Auth-Gateway:** JWT authentication via HttpOnly cookie.
- **Productivity → Gladys-Blog:** iframe + TLS proxying (skip verify).
- **Productivity → job-statistics-platform:** URI strip prefix, external volume for data persistence.
- **All sub-projects → Productivity:** Gateway mode detection via `window.location.pathname`.
