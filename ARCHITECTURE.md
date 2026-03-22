# ARCHITECTURE.md — Productivity Dashboard (Unified Platform)

> Единая платформа-хаб для управления локальными Docker-проектами с централизованной аутентификацией, дашбордом продуктивности и интеграцией подпроектов.

---

## 1. Обзор системы

Productivity Dashboard — это оркестрирующий проект, который объединяет несколько независимых приложений под единым reverse proxy (Caddy), обеспечивает централизованную аутентификацию и предоставляет персональный дашборд продуктивности.

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
│   ├── blog-wrapper.html     # iframe-обёртка для блога
│   ├── css/
│   │   └── style.css         # Единый файл стилей (~1700 строк)
│   ├── js/
│   │   ├── auth.js           # Аутентификация: login, register, verify
│   │   ├── app.js            # Основная логика: виджеты, TODO, расписание
│   │   ├── training-data.js  # Загрузчик CSV: план тренировок + рекорды 5 вёрст
│   │   └── word-of-day.js    # Слово дня: API + кэш + архив
│   ├── data/
│   │   ├── words.json              # Словарь для "Слова дня"
│   │   ├── training_schedule.csv   # → symlink / docker mount из 5run
│   │   └── records_sorted.csv     # → symlink / docker mount из 5run
│   └── quotes.json           # Цитаты (генерируются из markdown)
├── scripts/
│   └── parse_quotes.py       # Парсер цитат
├── docs/
│   └── auth-architecture.md  # Документация auth-архитектуры
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

    /admin/*             → auth-admin:80         (strip /admin)
    /admin               → /admin/ (redirect)

    /blog/               → /srv/www/blog-wrapper.html (iframe)
    /blog                → /blog/ (redirect)
    /blog-raw/*          → gladys-blog:443       (strip /blog-raw, TLS skip verify)
    /blog-raw            → /blog-raw/ (redirect)

    /jobs/api/*          → job-stats-api:8081    (strip /jobs)
    /jobs/*              → job-stats-frontend:3000 (strip /jobs)
    /jobs                → /jobs/ (redirect)

    /*                   → dashboard:80          (default, catch-all)
}
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
    CADDY -->|"/*"| DASH["Dashboard<br/>:80"]

    WRAPPER -->|"iframe src"| BLOG
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
    HTML["index.html"] --> AUTH_JS["auth.js<br/>checkAuth, login, register<br/>renderAuthForm, initAuth"]
    HTML --> APP_JS["app.js<br/>Виджеты, TODO, Schedule<br/>Running, Mortgage, Goals"]
    HTML --> WOD_JS["word-of-day.js<br/>fetchWordData, translate<br/>cache, archive"]
    HTML --> INIT["initAuth()"]

    AUTH_JS -->|"fetch /api/auth/*"| AUTH_API["Auth Gateway API"]
    APP_JS -->|"localStorage"| LS[("localStorage<br/>~23 ключей")]
    WOD_JS -->|"fetch"| DICT_API["Dictionary API"]
    WOD_JS -->|"fetch"| TRANS_API["MyMemory API"]
```

### 6.2 Порядок инициализации

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as auth.js
    participant M as app.js
    participant W as word-of-day.js

    B->>A: load auth.js
    B->>M: load app.js (виджеты рендерятся сразу)
    B->>W: load word-of-day.js
    B->>A: initAuth()

    A->>A: renderAuthForm() (готовим overlay)
    A->>A: checkAuth() → GET /api/auth/me
    alt Авторизован
        A->>A: hideAuthOverlay()
        A->>A: renderUserBadge()
        Note over B: Контент уже отрендерен в app.js
    else Не авторизован
        A->>A: showAuthOverlay()
        Note over B: Контент скрыт за overlay
    end

    W->>W: DOMContentLoaded → initWordOfDay()
```

### 6.3 Компоненты Dashboard

```mermaid
mindmap
  root((Dashboard))
    Header
      Notifications toggle
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
    Quote Banner
      Hourly rotation
      Shuffle
      Countdown
    Footer
      Export / Import data
```

### 6.4 Хранилище данных (localStorage)

| Ключ | Тип | Описание |
|------|-----|----------|
| `prod_days_v1` | `{startDate, failCount}` | Счётчик дней без привычки |
| `prod_cushions` | `number` | Финансовые подушки |
| `prod_mortgage_v1` | `{payment, debt, rate, ...}` | Ипотека |
| `prod_notif_enabled` | `"0"\|"1"` | Уведомления вкл/выкл |
| `prod_tasks_v1` | `[{id, text, done, current, ...}]` | Задачи |
| `prod_history_v1` | `[{id, text, addedAt, doneAt, workedMs}]` | История задач |
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
| `blog` | + gladys-blog | `make up-blog` |
| `jobs` | + job-stats-frontend, job-stats-api, job-stats-db | `make up-jobs` |
| `blog` + `jobs` | Все сервисы | `make up-all` |

### 8.3 Volumes

| Volume | Тип | Контейнер | Mount |
|--------|-----|-----------|-------|
| `caddy_data` | Named | gateway | /data |
| `caddy_config` | Named | gateway | /config |
| `auth_data` | Named | auth-db | /var/lib/mysql |
| `jobs_data` | External | job-stats-db | /var/lib/mysql |
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
2. **Caddyfile:** добавить `handle /path/*` с `uri strip_prefix` и `reverse_proxy`
3. **Dashboard `app.js`:** добавить объект в массив `PROJECTS`
4. **Навигация:** в подпроекте добавить "← Dashboard" ссылку при обнаружении gateway-режима
5. **API URL:** в подпроекте реализовать определение `basename` / API URL по `window.location.pathname`

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

## 10. Блог-обёртка (iframe pattern)

```mermaid
flowchart TB
    subgraph Page["blog-wrapper.html"]
        NAV["<div class='blog-nav'><br/>← Dashboard | Gladys Blog"]
        IFRAME["<iframe src='/blog-raw/'/>"]
    end

    subgraph Caddy["Caddyfile"]
        R1["/blog/ → serve blog-wrapper.html"]
        R2["/blog-raw/* → reverse_proxy gladys-blog:443"]
    end

    NAV --> |"href='/'"| DASH["Dashboard"]
    IFRAME --> |"src"| R2
    R2 --> BLOG["Gladys Blog<br/>(Hugo + Nginx)"]
```

**Зачем iframe:** Стили блога (GitHub-style тема) конфликтуют с Dashboard CSS. iframe обеспечивает полную изоляцию стилей, при этом навигационная панель принадлежит Dashboard.

---

## 11. Внешние API

| API | Использование | Файл |
|-----|--------------|------|
| `api.dictionaryapi.dev` | Определения слов (en) | word-of-day.js |
| `api.mymemory.translated.net` | Перевод en→ru | word-of-day.js |

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
up          # Core: Dashboard + Auth Gateway
down        # Stop all services (all profiles)
restart     # Restart core
logs        # Follow logs (all profiles)
up-all      # ALL: core + blog + jobs
up-blog     # Core + Gladys Blog
up-jobs     # Core + Job Statistics
quotes      # Parse quotes from markdown → quotes.json
open        # Open Dashboard in browser
build-auth  # Rebuild Auth Gateway containers
clean       # Remove all volumes and containers
status      # Show status of all services
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
