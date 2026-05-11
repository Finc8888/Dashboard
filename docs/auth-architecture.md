# Архитектура централизованной аутентификации

> Единый auth-сервис для всех локальных проектов с SSO, ролями и Gateway-паттерном.

---

## 1. Обзор

Проект **Auth Gateway** становится центральным сервисом аутентификации и управления пользователями.
**Dashboard** (Productivity) — главная точка входа: регистрация, логин, навигация по проектам.

### Текущие проекты

| Проект | Стек | Порт (внешний) | Доступ |
|--------|------|----------------|--------|
| **Dashboard** | Caddy + static | `8080` | `http://localhost:8080` |
| **Auth Gateway** | Go + MySQL + Caddy | `8888` | `http://localhost:8888/api` |
| **Gladys Blog** | Hugo + Nginx | — | `https://gladys-blog.local.net` |
| **Job Statistics** | Go + React + MySQL | `3000` | `http://localhost:3000` |

### Целевое состояние

Все проекты за единым Caddy reverse proxy. Auth Gateway валидирует каждый запрос через `forward_auth`.

---

## 2. Архитектура компонентов

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CADDY GATEWAY (:80 / :443)                  │
│                                                                     │
│  Все входящие запросы проходят через forward_auth → Auth Service    │
│                                                                     │
│  /                    → Dashboard (static)                          │
│  /api/auth/*          → Auth Gateway (Go API)                       │
│  /blog/*              → Gladys Blog (Nginx)                         │
│  /jobs/*              → Job Statistics (React + Go)                 │
│  /admin/*             → Auth Gateway (Admin UI)                     │
│  /projects/{name}/*   → Будущие проекты                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ forward_auth /api/auth/verify
         ▼
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Auth Gateway   │────▶│   MySQL DB   │     │  Dashboard   │
│  (Go :8080)     │     │  (users,     │     │  (Caddy      │
│                 │     │   roles,     │     │   static)    │
│  - /api/auth/*  │     │   sessions)  │     │              │
│  - /api/admin/* │     └──────────────┘     └──────────────┘
└─────────────────┘
         ▲
         │ JWT validation
         │
┌────────┴─────────────────────────────────────────────────┐
│                     Downstream Services                   │
│                                                           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Gladys  │  │ Job Stats    │  │ Future Project N  │   │
│  │  Blog    │  │ (React+Go)   │  │                   │   │
│  └──────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Диаграмма последовательности: регистрация и логин

```mermaid
sequenceDiagram
    actor U as Пользователь
    participant D as Dashboard<br/>(frontend)
    participant C as Caddy<br/>Gateway
    participant A as Auth Gateway<br/>(Go API)
    participant DB as MySQL

    Note over U,DB: Сценарий 1 — Регистрация (новый пользователь)

    U->>C: GET /
    C->>A: forward_auth /api/auth/verify
    A-->>C: 401 (нет токена)
    C->>D: Отдать Dashboard с формой регистрации

    U->>C: POST /api/auth/register {username, email, password}
    C->>A: proxy → Auth Gateway
    A->>DB: INSERT INTO users (username, email, password_hash, role)
    DB-->>A: OK (user_id)
    A-->>C: 201 {token: JWT, user: {...}}
    C-->>U: Set-Cookie: auth_token=JWT; Path=/; HttpOnly; SameSite=Lax

    Note over U,DB: Сценарий 2 — Логин (существующий пользователь)

    U->>C: POST /api/auth/login {email, password}
    C->>A: proxy → Auth Gateway
    A->>DB: SELECT * FROM users WHERE email = ?
    A->>A: bcrypt.Compare(password, hash)
    A-->>C: 200 {token: JWT, user: {...}}
    C-->>U: Set-Cookie: auth_token=JWT
```

---

## 4. Диаграмма последовательности: SSO при переходе между проектами

```mermaid
sequenceDiagram
    actor U as Пользователь
    participant D as Dashboard
    participant C as Caddy Gateway
    participant A as Auth Gateway
    participant S as Job Statistics

    Note over U,S: Переход из Dashboard в проект (авторизованный)

    U->>D: Клик "Job Statistics"
    D->>C: GET /jobs/
    C->>A: forward_auth /api/auth/verify<br/>Cookie: auth_token=JWT
    A->>A: Validate JWT (exp, signature)
    A-->>C: 200 + X-Auth-User: user_id<br/>X-Auth-Role: user
    C->>S: proxy → Job Statistics<br/>+ X-Auth-User + X-Auth-Role headers
    S-->>U: Страница проекта

    Note over U,S: Переход без авторизации

    U->>C: GET /jobs/
    C->>A: forward_auth /api/auth/verify<br/>(нет cookie)
    A-->>C: 401
    C-->>U: Redirect → /?redirect=/jobs/

    Note over U,S: Dashboard показывает форму логина<br/>после успешного входа — редирект на /jobs/
```

---

## 5. Модель данных

```mermaid
erDiagram
    users {
        bigint id PK "AUTO_INCREMENT"
        varchar username UK "NOT NULL, уникальный"
        varchar email UK "NOT NULL, уникальный"
        varchar password_hash "NOT NULL, bcrypt"
        enum role "admin | user (default: user)"
        timestamp created_at "DEFAULT CURRENT_TIMESTAMP"
        timestamp updated_at "ON UPDATE CURRENT_TIMESTAMP"
        timestamp deleted_at "NULL — soft delete"
    }

    sessions {
        bigint id PK "AUTO_INCREMENT"
        bigint user_id FK "→ users.id"
        varchar token_hash UK "SHA-256 хэш JWT"
        varchar ip "IP адрес при логине"
        varchar user_agent "Браузер"
        timestamp expires_at "NOT NULL"
        timestamp created_at "DEFAULT CURRENT_TIMESTAMP"
    }

    audit_log {
        bigint id PK "AUTO_INCREMENT"
        bigint user_id FK "→ users.id, NULL для анонимных"
        varchar action "login | logout | register | create_user | delete_user"
        varchar target "Описание цели действия"
        varchar ip "IP адрес"
        timestamp created_at "DEFAULT CURRENT_TIMESTAMP"
    }

    users ||--o{ sessions : "has"
    users ||--o{ audit_log : "generates"
```

---

## 6. Ролевая модель (RBAC)

```mermaid
flowchart LR
    subgraph Роли
        ADMIN["admin"]
        USER["user"]
    end

    subgraph Разрешения
        REG["Регистрация / Логин"]
        DASH["Dashboard"]
        PROJ["Проекты (blog, jobs, ...)"]
        ADM_UI["Админка: просмотр"]
        ADM_CRUD["Админка: CRUD пользователей"]
        ADM_AUDIT["Аудит-лог"]
    end

    USER --> REG
    USER --> DASH
    USER --> PROJ

    ADMIN --> REG
    ADMIN --> DASH
    ADMIN --> PROJ
    ADMIN --> ADM_UI
    ADMIN --> ADM_CRUD
    ADMIN --> ADM_AUDIT
```

| Действие | `user` | `admin` |
|----------|--------|---------|
| Регистрация / логин | + | + |
| Просмотр Dashboard | + | + |
| Переход в проекты | + | + |
| Просмотр списка пользователей | - | + |
| Создание пользователей | - | + |
| Удаление пользователей (soft) | - | + |
| Просмотр аудит-лога | - | + |
| Смена роли пользователя | - | + |

---

## 7. JWT-токен

### Структура payload

```json
{
  "sub": "42",
  "username": "friedfox",
  "email": "friedfox@example.com",
  "role": "admin",
  "iat": 1710500000,
  "exp": 1710586400
}
```

### Параметры

| Параметр | Значение |
|----------|----------|
| Алгоритм | HS256 |
| Время жизни | 24 часа |
| Хранение | HttpOnly cookie `auth_token` |
| Обновление | Sliding window: если осталось < 2ч, выдаётся новый при `verify` |
| Отзыв | Удаление записи в таблице `sessions` |

---

## 8. API Auth Gateway

### Публичные эндпоинты (без авторизации)

```
POST /api/auth/register    — Регистрация {username, email, password}
POST /api/auth/login       — Логин {email, password}
GET  /api/auth/verify      — Проверка JWT (для forward_auth)
POST /api/auth/logout      — Выход (удаление сессии + очистка cookie)
```

### Защищённые эндпоинты (role: admin)

```
GET    /api/admin/users           — Список всех пользователей
POST   /api/admin/users/create    — Создать пользователя
DELETE /api/admin/users/:id       — Soft delete пользователя
PATCH  /api/admin/users/:id/role  — Изменить роль {role: "admin"|"user"}
GET    /api/admin/stats           — Статистика
GET    /api/admin/audit           — Аудит-лог
```

---

## 9. Конфигурация Caddy Gateway

Единая точка входа для всех проектов:

```caddy
{
    # Для локальной разработки отключаем auto-HTTPS
    auto_https off
}

:80 {
    # ── Auth: проверка на каждый запрос (кроме публичных) ──
    @protected not path /api/auth/register /api/auth/login /api/auth/verify /api/health

    route @protected {
        forward_auth auth-gateway:8080 {
            uri /api/auth/verify
            copy_headers {
                X-Auth-User
                X-Auth-Role
            }
        }
    }

    # ── Роутинг по проектам ──
    handle /api/auth/* {
        reverse_proxy auth-gateway:8080
    }
    handle /api/admin/* {
        reverse_proxy auth-gateway:8080
    }

    handle /blog/* {
        uri strip_prefix /blog
        reverse_proxy gladys-blog:443 {
            transport http {
                tls_insecure_skip_verify
            }
        }
    }

    handle /jobs/* {
        uri strip_prefix /jobs
        reverse_proxy job-stats-frontend:3000
    }

    handle /jobs/api/* {
        uri strip_prefix /jobs
        reverse_proxy job-stats-api:8081
    }

    # ── Dashboard — всё остальное ──
    handle {
        reverse_proxy dashboard:80
    }

    encode gzip zstd
}
```

---

## 10. Docker Compose: целевая структура

```yaml
# Единый docker-compose.yaml для всех проектов
services:
  # ── Единый Gateway ──
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    networks: [gateway]
    depends_on: [auth-gateway, dashboard]

  # ── Auth Gateway ──
  auth-gateway:
    build: ../Auth-Gateway/backend
    environment:
      DB_HOST: auth-db
      JWT_SECRET: ${JWT_SECRET}
    networks: [gateway, auth-internal]
    depends_on: [auth-db]

  auth-db:
    image: mysql:8.0
    volumes: [auth_data:/var/lib/mysql]
    networks: [auth-internal]

  # ── Dashboard ──
  dashboard:
    image: caddy:2-alpine
    volumes:
      - ./www:/srv/www:ro
      - ./DashboardCaddyfile:/etc/caddy/Caddyfile:ro
    networks: [gateway]

  # ── Gladys Blog ──
  gladys-blog:
    build: ../Gladys-Blog
    networks: [gateway]

  # ── Job Statistics ──
  job-stats-frontend:
    build: ../job-statistics-platform/frontend
    networks: [gateway]

  job-stats-api:
    build: ../job-statistics-platform/backend
    networks: [gateway, jobs-internal]

  job-stats-db:
    image: mysql:8.0
    networks: [jobs-internal]

networks:
  gateway:        # Все сервисы + Caddy
  auth-internal:  # Auth Gateway ↔ Auth DB
  jobs-internal:  # Job Stats API ↔ Job Stats DB

volumes:
  auth_data:
  jobs_data:
```

---

## 11. Диаграмма развёртывания

```mermaid
flowchart TB
    subgraph Browser["Браузер"]
        U((Пользователь))
    end

    subgraph Docker["Docker Host"]
        subgraph GW["Caddy Gateway :80"]
            FWD["forward_auth"]
        end

        subgraph AUTH["Auth Gateway"]
            API["Go API :8080"]
            ADB[(MySQL<br/>users, sessions)]
        end

        subgraph DASH["Dashboard"]
            STATIC["Static files<br/>Caddy :80"]
        end

        subgraph BLOG["Gladys Blog"]
            NGINX["Nginx :443<br/>Hugo static"]
        end

        subgraph JOBS["Job Statistics"]
            REACT["React :3000"]
            GOAPI["Go API :8081"]
            JDB[(MySQL<br/>job_stats)]
        end

        subgraph FUTURE["Future Project N"]
            FN["..."]
        end
    end

    U -->|"HTTP/HTTPS"| GW
    GW -->|"forward_auth"| API
    API --> ADB
    GW -->|"/"| STATIC
    GW -->|"/blog/*"| NGINX
    GW -->|"/jobs/*"| REACT
    GW -->|"/jobs/api/*"| GOAPI
    GOAPI --> JDB
    GW -->|"/projects/N/*"| FN

    style GW fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style AUTH fill:#3b1f2b,stroke:#ef4444,color:#e2e8f0
    style DASH fill:#1a2e1a,stroke:#22c55e,color:#e2e8f0
    style BLOG fill:#2d2640,stroke:#a78bfa,color:#e2e8f0
    style JOBS fill:#2a2510,stroke:#f59e0b,color:#e2e8f0
```

---

## 12. Добавление нового проекта — чеклист

При появлении нового проекта:

1. **Docker**: добавить сервис в `docker-compose.yaml`, подключить к сети `gateway`
2. **Caddy**: добавить `handle /newproject/*` блок в Caddyfile
3. **Dashboard**: добавить объект в массив `PROJECTS` в `app.js`:
   ```js
   { id: 'new-project', label: 'New Project', icon: '...', url: '/newproject/', desc: '...' }
   ```
4. **Роли** (при необходимости): добавить project-specific permissions в RBAC
5. **Downstream**: сервис читает `X-Auth-User` и `X-Auth-Role` из headers — авторизация на уровне приложения

Никаких изменений в Auth Gateway не требуется.

---

## 13. Что нужно реализовать в Auth Gateway

### Бэкенд (Go)

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | Добавить `password_hash` (bcrypt) в модель `User` | P0 |
| 2 | Добавить поле `role` (enum: admin/user) | P0 |
| 3 | Реализовать `POST /api/auth/register` | P0 |
| 4 | Реализовать `POST /api/auth/login` | P0 |
| 5 | Реализовать `GET /api/auth/verify` (forward_auth endpoint) | P0 |
| 6 | JWT: подпись (HS256), валидация, sliding refresh | P0 |
| 7 | Middleware `RequireAuth` — проверка JWT из cookie | P0 |
| 8 | Middleware `RequireRole("admin")` — проверка роли | P0 |
| 9 | Таблица `sessions` + logout | P1 |
| 10 | Таблица `audit_log` + логирование действий | P1 |
| 11 | `PATCH /api/admin/users/:id/role` | P1 |
| 12 | CORS: заменить `*` на конкретный origin Gateway | P1 |

### Фронтенд (Dashboard)

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | Форма регистрации на Dashboard | P0 |
| 2 | Форма логина на Dashboard | P0 |
| 3 | Redirect-механизм: `/?redirect=/jobs/` | P0 |
| 4 | Показ/скрытие UI элементов по роли | P1 |
| 5 | Страница «Профиль» (смена пароля) | P2 |

### Миграции (SQL)

| # | Файл | Содержание |
|---|------|-----------|
| 1 | `002_add_auth.sql` | `ALTER TABLE users ADD password_hash, ADD role` |
| 2 | `003_sessions.sql` | `CREATE TABLE sessions (...)` |
| 3 | `004_audit_log.sql` | `CREATE TABLE audit_log (...)` |

---

## 14. Порядок реализации

```mermaid
gantt
    title Этапы реализации Auth Gateway
    dateFormat  YYYY-MM-DD
    axisFormat  %d.%m

    section P0 — Ядро
    Миграции БД (password, role)         :p0_1, 2026-03-16, 1d
    JWT: подпись + валидация              :p0_2, after p0_1, 2d
    register + login endpoints            :p0_3, after p0_2, 2d
    verify endpoint (forward_auth)        :p0_4, after p0_3, 1d
    Auth middleware (RequireAuth, Role)    :p0_5, after p0_4, 1d
    Формы логин/регистрация в Dashboard   :p0_6, after p0_5, 2d
    Caddy Gateway (forward_auth config)   :p0_7, after p0_6, 1d
    Единый docker-compose                 :p0_8, after p0_7, 1d

    section P1 — Улучшения
    Sessions + logout                     :p1_1, after p0_8, 1d
    Audit log                             :p1_2, after p1_1, 1d
    RBAC UI в админке                     :p1_3, after p1_2, 2d

    section P2 — Опционально
    Профиль (смена пароля)                :p2_1, after p1_3, 1d
    OAuth2 (GitHub login)                 :p2_2, after p2_1, 3d
```

---

## 15. Безопасность

| Мера | Реализация |
|------|-----------|
| Хэширование паролей | bcrypt, cost=12 |
| JWT хранение | HttpOnly, SameSite=Lax cookie |
| CSRF | SameSite=Lax + проверка Origin header для мутаций |
| Rate limiting | 10 req/min на `/api/auth/login` (защита от брутфорса) |
| CORS | Конкретный origin вместо `*` |
| Soft delete | `deleted_at` — пользователи не удаляются физически |
| Аудит | Все auth-действия логируются в `audit_log` |
| Сессии | Хэш токена в БД, возможность отзыва |

---

## 16. Статус реализации

| Компонент | Статус | Детали |
|-----------|--------|--------|
| Миграции БД (password, role, sessions, audit) | ✅ Готово | `002_add_auth.sql`, `003_sessions.sql`, `004_audit_log.sql` |
| JWT (подпись, валидация, sliding refresh) | ✅ Готово | `internal/auth/jwt.go`, HS256, 24ч, refresh < 2ч |
| Auth endpoints (register, login, verify, logout, me) | ✅ Готово | `internal/handlers/auth.go` |
| Auth middleware (RequireAuth, RequireRole) | ✅ Готово | `internal/middleware/middleware.go` |
| Admin endpoints (CRUD, roles, audit) | ✅ Готово | `internal/handlers/admin.go` |
| Admin Panel UI (login, users, audit, stats) | ✅ Готово | `Auth-Gateway/frontend/` |
| Dashboard: auth overlay (login/register) | ✅ Готово | `www/js/auth.js` |
| Dashboard: user badge + logout | ✅ Готово | header user-badge |
| Unified Caddyfile (forward_auth routing) | ✅ Готово | `Caddyfile` |
| Unified docker-compose (all services) | ✅ Готово | profiles: blog, jobs |
| Gladys Blog Dockerfile (unified build) | ✅ Готово | root `Dockerfile` |
| Makefile (up, up-all, up-blog, up-jobs) | ✅ Готово | `Makefile` |
| Sessions + logout | ✅ Готово | P1 включён в P0 |
| Audit log | ✅ Готово | P1 включён в P0 |
| RBAC UI в админке | ✅ Готово | toggle role в admin panel |
