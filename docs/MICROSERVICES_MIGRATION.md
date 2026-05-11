# План миграции на микросервисную архитектуру

> Поэтапный план перехода Productivity Platform с монолитно-модульной архитектуры на полноценную микросервисную архитектуру с применением best practices и паттернов.

---

## 1. Текущее состояние (AS-IS)

### 1.1 Архитектурный стиль: Modular Monolith + Shared Gateway

```mermaid
flowchart TB
    subgraph Current["Текущая архитектура"]
        GW["Caddy Gateway<br/>(Reverse Proxy)"]
        DASH["Dashboard<br/>(Static Files)"]
        AUTH["Auth Gateway<br/>(Monolith Go)"]
        AUTH_DB[("Auth MySQL")]
        BLOG["Blog<br/>(Hugo Static)"]
        JOBS_FE["Jobs Frontend<br/>(React SPA)"]
        JOBS_API["Jobs API<br/>(Monolith Go)"]
        JOBS_DB[("Jobs MySQL")]
    end

    GW --> DASH
    GW --> AUTH
    GW --> BLOG
    GW --> JOBS_FE
    GW --> JOBS_API
    AUTH --> AUTH_DB
    JOBS_API --> JOBS_DB

    style Current fill:#1a1d27,stroke:#2a2d3e,color:#e2e8f0
```

### 1.2 Проблемы текущей архитектуры

| Проблема | Описание | Влияние |
|----------|----------|---------|
| **Синхронная связность** | Dashboard напрямую вызывает Auth API | Каскадные отказы |
| **Нет Service Discovery** | Хардкод имён контейнеров в Caddyfile | Невозможность масштабирования |
| **Единая точка отказа** | Caddy Gateway — SPOF | Вся платформа недоступна |
| **Нет observability** | Логи только в stdout, нет метрик | Сложная отладка |
| **localStorage** | Данные Dashboard в браузере | Потеря при смене origin |
| **Общий Docker Compose** | Все сервисы в одном файле | Сложный деплой |
| **Нет API versioning** | Только `/api/v1` в Jobs | Сложность эволюции API |
| **Нет circuit breaker** | Прямые HTTP-вызовы | Каскадные отказы |
| **Monolith Auth** | Auth = API + Admin UI + Sessions | Нельзя масштабировать отдельно |

---

## 2. Целевое состояние (TO-BE)

### 2.1 Архитектурный стиль: Microservices + Event-Driven

```mermaid
flowchart TB
    subgraph Edge["Edge Layer"]
        APIGW["API Gateway<br/>(Kong / Traefik)"]
        CDN["CDN / Static Host<br/>(Dashboard + Blog)"]
    end

    subgraph Services["Microservices"]
        AUTH_SVC["Auth Service<br/>(Go)"]
        USER_SVC["User Service<br/>(Go)"]
        JOBS_SVC["Jobs Service<br/>(Go)"]
        STATS_SVC["Stats Service<br/>(Go)"]
        NOTIFY_SVC["Notification Service<br/>(Go)"]
        DASH_BFF["Dashboard BFF<br/>(Go)"]
    end

    subgraph Data["Data Layer"]
        AUTH_DB[("Auth DB<br/>PostgreSQL")]
        USER_DB[("User DB<br/>PostgreSQL")]
        JOBS_DB[("Jobs DB<br/>PostgreSQL")]
        CACHE[("Redis<br/>Cache + Sessions")]
        MQ["NATS / RabbitMQ<br/>Event Bus"]
    end

    subgraph Infra["Infrastructure"]
        CONSUL["Consul<br/>Service Discovery"]
        PROM["Prometheus<br/>Metrics"]
        GRAF["Grafana<br/>Dashboards"]
        JAEGER["Jaeger<br/>Tracing"]
        ELK["ELK Stack<br/>Centralized Logs"]
    end

    APIGW --> AUTH_SVC
    APIGW --> USER_SVC
    APIGW --> JOBS_SVC
    APIGW --> STATS_SVC
    APIGW --> DASH_BFF
    CDN --> APIGW

    AUTH_SVC --> AUTH_DB
    AUTH_SVC --> CACHE
    USER_SVC --> USER_DB
    JOBS_SVC --> JOBS_DB
    STATS_SVC --> JOBS_DB
    DASH_BFF --> CACHE

    AUTH_SVC -->|"events"| MQ
    USER_SVC -->|"events"| MQ
    JOBS_SVC -->|"events"| MQ
    MQ --> NOTIFY_SVC
    MQ --> STATS_SVC

    Services --> CONSUL
    Services --> PROM
    PROM --> GRAF
    Services --> JAEGER

    style Edge fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style Services fill:#1a2e1a,stroke:#22c55e,color:#e2e8f0
    style Data fill:#3b1f2b,stroke:#ef4444,color:#e2e8f0
    style Infra fill:#2d2640,stroke:#a78bfa,color:#e2e8f0
```

---

## 3. Применяемые паттерны микросервисной архитектуры

### 3.1 Каталог паттернов

```mermaid
mindmap
  root((Microservice<br/>Patterns))
    Decomposition
      Decompose by Business Capability
      Strangler Fig
    Communication
      API Gateway
      Backend for Frontend (BFF)
      Async Messaging
    Data Management
      Database per Service
      CQRS
      Event Sourcing (частично)
      Saga Pattern
    Reliability
      Circuit Breaker
      Retry with Backoff
      Bulkhead
      Health Check API
    Observability
      Distributed Tracing
      Log Aggregation
      Application Metrics
      Health Check Dashboard
    Deployment
      Service per Container
      Sidecar
      Service Mesh (опционально)
    Discovery
      Service Registry
      Client-side Discovery
    Security
      Access Token (JWT)
      API Key
      Rate Limiting
```

### 3.2 Подробное описание паттернов

#### 3.2.1 Strangler Fig Pattern (основа миграции)

```mermaid
flowchart LR
    subgraph Phase1["Фаза 1: Monolith"]
        M1["Auth Gateway<br/>(всё в одном)"]
    end

    subgraph Phase2["Фаза 2: Strangler"]
        M2["Auth Gateway<br/>(legacy)"]
        NEW["User Service<br/>(new)"]
        PROXY["API Gateway<br/>(router)"]
        PROXY -->|"/api/auth/*"| M2
        PROXY -->|"/api/users/*"| NEW
    end

    subgraph Phase3["Фаза 3: Decomposed"]
        AUTH_S["Auth Service"]
        USER_S["User Service"]
        PROXY2["API Gateway"]
        PROXY2 --> AUTH_S
        PROXY2 --> USER_S
    end

    Phase1 -->|"Шаг 1"| Phase2
    Phase2 -->|"Шаг 2"| Phase3
```

**Применение:** Auth Gateway содержит как auth-логику, так и admin CRUD пользователей. Разделяем на Auth Service (только аутентификация) и User Service (управление пользователями).

#### 3.2.2 API Gateway Pattern

```mermaid
flowchart TB
    CLIENT["Client<br/>(Browser)"] --> APIGW["API Gateway"]

    APIGW --> |"Authentication"| AUTH["Auth Service"]
    APIGW --> |"Rate Limiting"| APIGW
    APIGW --> |"Request Routing"| SERVICES["Microservices"]
    APIGW --> |"Response Caching"| CACHE[("Redis")]
    APIGW --> |"Circuit Breaking"| APIGW
    APIGW --> |"Request/Response<br/>Transformation"| SERVICES
    APIGW --> |"Logging & Metrics"| OBSERV["Observability"]
```

**Реализация:** Замена Caddy на Kong или Traefik с поддержкой:
- JWT-валидация на уровне Gateway
- Rate limiting per-endpoint
- Circuit breaker для downstream сервисов
- Request ID propagation

#### 3.2.3 Backend for Frontend (BFF)

```mermaid
flowchart TB
    BROWSER["Dashboard SPA"] --> BFF["Dashboard BFF<br/>(Go)"]

    BFF --> AUTH["Auth Service"]
    BFF --> JOBS["Jobs Service"]
    BFF --> STATS["Stats Service"]
    BFF --> CACHE[("Redis<br/>Aggregated Data")]

    Note1["BFF агрегирует данные<br/>из нескольких сервисов<br/>в один API-ответ"]
```

**Применение:** Dashboard сейчас хранит данные в localStorage. BFF позволит:
- Серверное хранение пользовательских данных (задачи, прогресс бега, ипотека)
- Агрегация данных из нескольких сервисов в один запрос
- Server-Side Rendering (опционально)

#### 3.2.4 Database per Service

```mermaid
flowchart LR
    AUTH_SVC["Auth<br/>Service"] --> AUTH_DB[("auth_db<br/>PostgreSQL<br/>users, sessions")]
    USER_SVC["User<br/>Service"] --> USER_DB[("user_db<br/>PostgreSQL<br/>profiles, preferences")]
    JOBS_SVC["Jobs<br/>Service"] --> JOBS_DB[("jobs_db<br/>PostgreSQL<br/>companies, jobs, skills")]
    DASH_SVC["Dashboard<br/>BFF"] --> DASH_DB[("dash_db<br/>PostgreSQL<br/>tasks, progress, settings")]
```

**Принцип:** Каждый сервис владеет своей базой данных. Другие сервисы взаимодействуют только через API или события.

#### 3.2.5 CQRS (Command Query Responsibility Segregation)

```mermaid
flowchart TB
    subgraph Write["Command Side"]
        CMD["POST/PUT/DELETE<br/>→ Jobs Service"]
        CMD --> W_DB[("Write DB<br/>PostgreSQL")]
        CMD --> EVENT["Event Published<br/>job.created<br/>job.updated"]
    end

    subgraph Read["Query Side"]
        QRY["GET /stats/*<br/>→ Stats Service"]
        QRY --> R_DB[("Read Model<br/>Materialized Views")]
    end

    EVENT --> |"async"| PROJ["Projection<br/>Service"]
    PROJ --> R_DB

    style Write fill:#3b1f2b,stroke:#ef4444,color:#e2e8f0
    style Read fill:#1a2e1a,stroke:#22c55e,color:#e2e8f0
```

**Применение:** Stats Service в Job Statistics выполняет тяжёлые агрегации (GROUP BY, JOIN). При CQRS:
- Write: Jobs Service обрабатывает CRUD
- Read: Stats Service читает из предвычисленных materialized views
- Проекция: Асинхронное обновление views при изменении данных

#### 3.2.6 Event-Driven Architecture

```mermaid
flowchart LR
    subgraph Producers
        AUTH["Auth Service"]
        JOBS["Jobs Service"]
        USER["User Service"]
    end

    MQ["NATS / RabbitMQ<br/>Event Bus"]

    subgraph Consumers
        AUDIT["Audit Service"]
        NOTIFY["Notification Service"]
        STATS["Stats Projector"]
        SEARCH["Search Indexer"]
    end

    AUTH -->|"user.registered<br/>user.logged_in<br/>user.deleted"| MQ
    JOBS -->|"job.created<br/>job.updated<br/>skill.added"| MQ
    USER -->|"profile.updated<br/>role.changed"| MQ

    MQ --> AUDIT
    MQ --> NOTIFY
    MQ --> STATS
    MQ --> SEARCH
```

**Формат события:**

```json
{
  "id": "evt_abc123",
  "type": "user.registered",
  "source": "auth-service",
  "time": "2026-03-15T13:00:00Z",
  "data": {
    "user_id": 42,
    "username": "friedfox",
    "email": "user@example.com"
  },
  "metadata": {
    "correlation_id": "req_xyz789",
    "trace_id": "trace_456"
  }
}
```

#### 3.2.7 Circuit Breaker

```mermaid
stateDiagram-v2
    [*] --> Closed: Инициализация
    Closed --> Open: failure_count >= threshold (5)
    Open --> HalfOpen: timeout (30s)
    HalfOpen --> Closed: probe_request succeeded
    HalfOpen --> Open: probe_request failed

    Closed: Все запросы проходят
    Open: Все запросы отклоняются (503)
    HalfOpen: 1 пробный запрос
```

**Применение:** Dashboard BFF использует circuit breaker при вызове каждого downstream сервиса.

#### 3.2.8 Saga Pattern

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant A as Auth Service
    participant U as User Service
    participant N as Notification Service

    Note over O: Saga: "Register User"
    O->>A: 1. Create credentials
    A-->>O: OK (user_id=42)

    O->>U: 2. Create profile (user_id=42)
    U-->>O: OK

    O->>N: 3. Send welcome email
    N-->>O: OK

    Note over O: Saga completed

    alt Step 2 fails
        O->>A: Compensate: Delete credentials (user_id=42)
        Note over O: Saga rolled back
    end
```

**Применение:** Регистрация пользователя затрагивает Auth Service (credentials) + User Service (profile). Saga обеспечивает согласованность без распределённых транзакций.

---

## 4. Целевая декомпозиция сервисов

### 4.1 Bounded Contexts (DDD)

```mermaid
flowchart TB
    subgraph Identity["Identity Context"]
        AUTH_BC["Auth Service<br/>• JWT sign/verify<br/>• Login / Logout<br/>• Sessions<br/>• Password reset"]
    end

    subgraph UserMgmt["User Management Context"]
        USER_BC["User Service<br/>• CRUD пользователей<br/>• Роли и разрешения<br/>• Профили<br/>• Аудит"]
    end

    subgraph JobMarket["Job Market Context"]
        JOBS_BC["Jobs Service<br/>• CRUD вакансий<br/>• Companies<br/>• Skills catalog<br/>• Locations"]

        STATS_BC["Stats Service<br/>• Агрегации<br/>• Materialized views<br/>• Аналитика"]
    end

    subgraph Productivity["Productivity Context"]
        DASH_BC["Dashboard BFF<br/>• Задачи<br/>• Прогресс бега<br/>• Привычки<br/>• Ипотека<br/>• Настройки"]
    end

    subgraph Content["Content Context"]
        BLOG_BC["Blog Service<br/>• Hugo static<br/>• CDN deployment"]
    end

    subgraph Crosscut["Cross-Cutting"]
        NOTIFY_BC["Notification Service<br/>• Browser push<br/>• Email (будущее)"]
        AUDIT_BC["Audit Service<br/>• Event log<br/>• Compliance"]
    end

    AUTH_BC -->|"user.authenticated"| USER_BC
    USER_BC -->|"user.created"| NOTIFY_BC
    JOBS_BC -->|"job.created"| STATS_BC
    JOBS_BC -->|"job.updated"| STATS_BC
    AUTH_BC -->|"auth.login"| AUDIT_BC
    USER_BC -->|"user.deleted"| AUDIT_BC

    style Identity fill:#3b1f2b,stroke:#ef4444,color:#e2e8f0
    style UserMgmt fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    style JobMarket fill:#2a2510,stroke:#f59e0b,color:#e2e8f0
    style Productivity fill:#1a2e1a,stroke:#22c55e,color:#e2e8f0
    style Content fill:#2d2640,stroke:#a78bfa,color:#e2e8f0
    style Crosscut fill:#1a1d27,stroke:#64748b,color:#e2e8f0
```

### 4.2 Контракты между сервисами

| Producer | Consumer | Событие | Данные |
|----------|----------|---------|--------|
| Auth Service | Audit Service | `auth.login` | user_id, ip, timestamp |
| Auth Service | Audit Service | `auth.logout` | user_id, ip |
| Auth Service | Audit Service | `auth.login_failed` | email, ip |
| User Service | Notification Service | `user.created` | user_id, email |
| User Service | Audit Service | `user.deleted` | user_id, admin_id |
| User Service | Audit Service | `user.role_changed` | user_id, old_role, new_role |
| Jobs Service | Stats Service | `job.created` | job_id, company_id, skills[] |
| Jobs Service | Stats Service | `job.updated` | job_id, changed_fields |
| Jobs Service | Stats Service | `job.deleted` | job_id |

### 4.3 API-контракты целевых сервисов

```
Auth Service (:8001)
  POST /auth/register        → {token, user_id}
  POST /auth/login           → {token, user_id}
  POST /auth/logout          → {status}
  GET  /auth/verify          → {user_id, role} + headers
  POST /auth/refresh         → {token}
  POST /auth/password/reset  → {status}

User Service (:8002)
  GET    /users              → [User]
  GET    /users/{id}         → User
  POST   /users              → User
  DELETE /users/{id}         → {status}
  PATCH  /users/{id}/role    → {status}
  GET    /users/{id}/profile → UserProfile
  PUT    /users/{id}/profile → UserProfile

Jobs Service (:8003)
  GET/POST/PUT/DELETE /companies
  GET/POST/PUT/DELETE /jobs
  GET/POST/PUT/DELETE /skills
  POST /jobs/{id}/skills     → {status}

Stats Service (:8004) [Read-Only]
  GET /stats/top-skills
  GET /stats/salaries
  GET /stats/companies
  GET /stats/databases
  GET /stats/languages

Dashboard BFF (:8005)
  GET/PUT    /me/tasks       → [Task]
  GET/PUT    /me/running     → RunningProgress
  GET/PUT    /me/habits      → HabitData
  GET/PUT    /me/mortgage    → MortgageData
  GET/PUT    /me/settings    → UserSettings
  GET        /me/dashboard   → AggregatedDashboard

Notification Service (:8006)
  POST /notifications/subscribe   → {status}
  POST /notifications/send        → {status}

Audit Service (:8007) [Internal Only]
  GET /audit/log             → [AuditEntry]
  GET /audit/stats           → AuditStats
```

---

## 5. Целевая модель данных

### 5.1 Auth DB (PostgreSQL)

```mermaid
erDiagram
    credentials {
        UUID id PK
        VARCHAR email UK
        VARCHAR password_hash
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    sessions {
        UUID id PK
        UUID credential_id FK
        VARCHAR token_hash UK
        INET ip
        VARCHAR user_agent
        TIMESTAMP expires_at
        TIMESTAMP created_at
    }

    refresh_tokens {
        UUID id PK
        UUID credential_id FK
        VARCHAR token_hash UK
        TIMESTAMP expires_at
        BOOLEAN revoked
    }

    credentials ||--o{ sessions : "has"
    credentials ||--o{ refresh_tokens : "has"
```

### 5.2 User DB (PostgreSQL)

```mermaid
erDiagram
    users {
        UUID id PK "same as credentials.id"
        VARCHAR username UK
        VARCHAR display_name
        ENUM role "admin, user"
        JSONB preferences
        TIMESTAMP created_at
        TIMESTAMP deleted_at
    }

    user_profiles {
        UUID id PK
        UUID user_id FK UK
        TEXT bio
        VARCHAR avatar_url
        JSONB metadata
    }

    users ||--o| user_profiles : "has"
```

### 5.3 Dashboard DB (PostgreSQL)

```mermaid
erDiagram
    tasks {
        UUID id PK
        UUID user_id FK
        VARCHAR text
        BOOLEAN done
        BOOLEAN current
        DATE added_date
        TIMESTAMP done_at
        INT sort_order
    }

    running_results {
        UUID id PK
        UUID user_id FK
        ENUM distance "5km, 10km, half, marathon"
        INT time_seconds
        DATE run_date
        TIMESTAMP created_at
    }

    habits {
        UUID id PK
        UUID user_id FK UK
        DATE start_date
        INT fail_count
    }

    user_settings {
        UUID id PK
        UUID user_id FK UK
        JSONB mortgage_data
        INT cushion_count
        JSONB goals_checked
        JSONB reading_progress
        JSONB stats_counters
    }

    tasks }o--|| users : "belongs to"
    running_results }o--|| users : "belongs to"
    habits ||--|| users : "belongs to"
    user_settings ||--|| users : "belongs to"
```

---

## 6. Инфраструктура

### 6.1 Целевой Docker Compose

```mermaid
flowchart TB
    subgraph Edge
        TRAEFIK["Traefik<br/>:80, :443, :8080 (dashboard)"]
    end

    subgraph Services
        AUTH["Auth<br/>:8001"]
        USER["User<br/>:8002"]
        JOBS["Jobs<br/>:8003"]
        STATS["Stats<br/>:8004"]
        BFF["Dashboard BFF<br/>:8005"]
        NOTIFY["Notification<br/>:8006"]
        AUDIT["Audit<br/>:8007"]
    end

    subgraph Data
        AUTH_PG[("Auth PG")]
        USER_PG[("User PG")]
        JOBS_PG[("Jobs PG")]
        DASH_PG[("Dash PG")]
        REDIS[("Redis")]
        NATS["NATS"]
    end

    subgraph Observability
        PROM["Prometheus"]
        GRAF["Grafana"]
        JAEGER["Jaeger"]
        LOKI["Loki"]
    end

    subgraph Static
        CDN["Caddy<br/>Dashboard + Blog<br/>Static Files"]
    end

    TRAEFIK --> AUTH & USER & JOBS & STATS & BFF & CDN
    AUTH --> AUTH_PG & REDIS & NATS
    USER --> USER_PG & NATS
    JOBS --> JOBS_PG & NATS
    STATS --> JOBS_PG
    BFF --> DASH_PG & REDIS
    NOTIFY --> NATS
    AUDIT --> NATS
    Services --> PROM
    PROM --> GRAF
    Services --> JAEGER
```

### 6.2 Observability Stack

| Компонент | Технология | Назначение |
|-----------|-----------|-----------|
| Метрики | Prometheus + Grafana | CPU, memory, request rate, error rate, latency |
| Логирование | Loki + Promtail | Centralized structured logs (JSON) |
| Трассировка | Jaeger (OpenTelemetry) | Distributed request tracing |
| Alerting | Grafana Alerting | Slack/Email оповещения |
| Health | `/health` + `/ready` | Liveness + Readiness probes |

### 6.3 Health Check Protocol

Каждый сервис экспортирует два эндпоинта:

```
GET /health  → 200 { "status": "ok" }             # Liveness: процесс жив
GET /ready   → 200 { "status": "ready" }           # Readiness: готов к трафику
              → 503 { "status": "not_ready",        # Не готов (DB недоступна)
                      "checks": { "db": "fail" } }
```

---

## 7. Поэтапный план миграции

### 7.1 Gantt-диаграмма

```mermaid
gantt
    title Миграция на микросервисную архитектуру
    dateFormat YYYY-MM-DD
    axisFormat %b %Y

    section Фаза 0 — Подготовка
    Observability stack (Prometheus + Grafana + Loki)    :f0_1, 2026-04-01, 14d
    Health check endpoints во все сервисы                :f0_2, after f0_1, 7d
    Structured logging (JSON)                           :f0_3, after f0_1, 7d
    Замена Caddy → Traefik (API Gateway)                :f0_4, after f0_2, 10d
    Redis для сессий и кэша                             :f0_5, after f0_4, 7d

    section Фаза 1 — Strangler Fig: Auth
    Выделение Auth Service (только auth логика)          :f1_1, after f0_5, 14d
    Выделение User Service (CRUD + roles + audit)       :f1_2, after f1_1, 14d
    Миграция MySQL → PostgreSQL (auth + users)          :f1_3, after f1_2, 10d
    Event bus (NATS) + Audit Service                    :f1_4, after f1_3, 10d

    section Фаза 2 — Dashboard BFF
    Dashboard BFF (серверное хранение)                  :f2_1, after f1_4, 21d
    Миграция localStorage → Dashboard DB               :f2_2, after f2_1, 7d
    Notification Service                                :f2_3, after f2_2, 10d

    section Фаза 3 — Jobs Decomposition
    CQRS: разделение Jobs → Write + Read                :f3_1, after f2_3, 14d
    Stats Service (materialized views)                  :f3_2, after f3_1, 14d
    Миграция Jobs MySQL → PostgreSQL                    :f3_3, after f3_2, 7d

    section Фаза 4 — Production Readiness
    Circuit Breaker + Retry + Bulkhead                  :f4_1, after f3_3, 10d
    Distributed Tracing (OpenTelemetry)                 :f4_2, after f4_1, 7d
    Load testing + Performance tuning                   :f4_3, after f4_2, 7d
    Documentation + Runbooks                            :f4_4, after f4_3, 7d
```

### 7.2 Описание фаз

#### Фаза 0 — Подготовка инфраструктуры (5 недель)

**Цель:** Заложить фундамент observability и API Gateway до начала декомпозиции.

| Шаг | Задача | Паттерн | Результат |
|-----|--------|---------|-----------|
| 0.1 | Развернуть Prometheus + Grafana + Loki | Log Aggregation, Application Metrics | Мониторинг всех сервисов |
| 0.2 | Добавить `/health` и `/ready` во все Go-сервисы | Health Check API | Автоматическое обнаружение проблем |
| 0.3 | Перевести логи на JSON (structured logging) | Log Aggregation | Парсинг логов в Loki |
| 0.4 | Заменить Caddy Gateway на Traefik | API Gateway | Rate limiting, JWT-валидация на уровне Gateway |
| 0.5 | Добавить Redis | Externalized Session Store | Сессии не в MySQL, отказоустойчивость |

**Критерий готовности:** Grafana-дашборд показывает метрики всех сервисов, логи агрегированы в Loki.

#### Фаза 1 — Strangler Fig: Auth (7 недель)

**Цель:** Разделить монолитный Auth Gateway на два независимых сервиса.

```mermaid
flowchart LR
    subgraph Before["До"]
        AUTH_MONO["Auth Gateway<br/>auth + admin + audit"]
    end

    subgraph After["После"]
        AUTH_SVC["Auth Service<br/>login, register, verify<br/>sessions, JWT"]
        USER_SVC["User Service<br/>CRUD users, roles<br/>profiles, admin panel"]
        AUDIT_SVC["Audit Service<br/>event consumer<br/>log storage"]
    end

    AUTH_MONO -->|"Strangler Fig"| AUTH_SVC
    AUTH_MONO -->|"Strangler Fig"| USER_SVC
    AUTH_MONO -->|"Extract"| AUDIT_SVC
```

| Шаг | Задача | Паттерн | Риски |
|-----|--------|---------|-------|
| 1.1 | Выделить Auth Service (register, login, verify, logout) | Strangler Fig | Обратная совместимость API |
| 1.2 | Выделить User Service (CRUD, roles, admin panel) | Decompose by Business Capability | Дублирование данных |
| 1.3 | Миграция MySQL → PostgreSQL | Database per Service | Downtime при миграции |
| 1.4 | NATS + Audit Service (event consumer) | Event-Driven, Async Messaging | Eventual consistency |

**Критерий готовности:** Auth и User — отдельные контейнеры с отдельными БД. Audit заполняется через события.

#### Фаза 2 — Dashboard BFF (5 недель)

**Цель:** Перенести данные пользователя из localStorage на сервер.

```mermaid
flowchart TB
    subgraph Before["До: Client-Side Storage"]
        BROWSER["Browser"] --> LS[("localStorage<br/>~15 ключей")]
    end

    subgraph After["После: Server-Side Storage"]
        BROWSER2["Browser"] --> BFF["Dashboard BFF"]
        BFF --> DASH_DB[("Dashboard DB<br/>PostgreSQL")]
        BFF --> AUTH_SVC["Auth Service<br/>(verify JWT)"]
        BFF --> REDIS[("Redis<br/>cache")]
    end
```

| Шаг | Задача | Паттерн | Результат |
|-----|--------|---------|-----------|
| 2.1 | Создать Dashboard BFF с API для задач, бега, привычек, ипотеки | Backend for Frontend | Серверное хранение |
| 2.2 | Миграция localStorage → Dashboard DB | Data Migration | Данные не теряются при смене origin |
| 2.3 | Notification Service (browser push через события) | Event-Driven, Async Messaging | Расписание и задачи |

**Критерий готовности:** Dashboard работает с BFF API. localStorage используется только как offline-кэш.

#### Фаза 3 — Jobs Decomposition (5 недель)

**Цель:** Разделить CRUD и аналитику в Job Statistics.

| Шаг | Задача | Паттерн | Результат |
|-----|--------|---------|-----------|
| 3.1 | Разделить Jobs API на Write (CRUD) и Read (Stats) | CQRS | Независимое масштабирование |
| 3.2 | Stats Service с materialized views | CQRS Read Model | Мгновенные ответы на агрегации |
| 3.3 | Миграция MySQL → PostgreSQL | Database per Service | Единая СУБД на платформе |

#### Фаза 4 — Production Readiness (4 недели)

| Шаг | Задача | Паттерн | Результат |
|-----|--------|---------|-----------|
| 4.1 | Circuit Breaker + Retry + Bulkhead | Reliability Patterns | Устойчивость к отказам |
| 4.2 | OpenTelemetry (distributed tracing) | Distributed Tracing | Сквозная трассировка |
| 4.3 | Нагрузочное тестирование (k6 / vegeta) | Performance Testing | SLO/SLA определены |
| 4.4 | Документация + Runbooks | Operational Excellence | Поддержка в production |

---

## 8. Стандарты разработки микросервисов

### 8.1 Шаблон Go-микросервиса

```
service-name/
├── cmd/
│   └── server/
│       └── main.go           # Инициализация, graceful shutdown
├── internal/
│   ├── config/               # Env-based config
│   ├── domain/               # Business entities
│   ├── repository/           # Database access (interface + impl)
│   ├── service/              # Business logic
│   ├── handler/              # HTTP handlers
│   ├── middleware/            # Auth, logging, metrics
│   └── event/                # Event publisher/consumer
├── pkg/
│   ├── health/               # Health check utilities
│   └── logger/               # Structured logger
├── migrations/               # SQL migrations (goose)
├── Dockerfile
├── go.mod
└── .env.example
```

### 8.2 Стандартные middleware для каждого сервиса

```go
// Порядок: снаружи → внутрь
handler = middleware.Recovery(handler)         // 1. Panic recovery
handler = middleware.RequestID(handler)        // 2. X-Request-ID
handler = middleware.Logger(handler)           // 3. Structured logging
handler = middleware.Metrics(handler)          // 4. Prometheus metrics
handler = middleware.Tracing(handler)          // 5. OpenTelemetry span
handler = middleware.CORS(handler)             // 6. CORS headers
handler = middleware.RateLimit(handler)        // 7. Per-IP rate limiting
```

### 8.3 Стандартные метрики (Prometheus)

```
http_requests_total{method, path, status}     # Счётчик запросов
http_request_duration_seconds{method, path}   # Гистограмма latency
http_requests_in_flight{service}              # Gauge текущих запросов
db_connections_active{service}                # Gauge активных подключений
event_published_total{type}                   # Счётчик опубликованных событий
event_consumed_total{type, status}            # Счётчик обработанных событий
```

---

## 9. Стратегия миграции данных

### 9.1 MySQL → PostgreSQL

```mermaid
flowchart LR
    subgraph Step1["Шаг 1: Dual Write"]
        APP["Service"] --> MYSQL["MySQL (primary)"]
        APP --> PG["PostgreSQL (shadow)"]
    end

    subgraph Step2["Шаг 2: Switch Primary"]
        APP2["Service"] --> PG2["PostgreSQL (primary)"]
        APP2 -.->|"readonly"| MYSQL2["MySQL (readonly)"]
    end

    subgraph Step3["Шаг 3: Decommission"]
        APP3["Service"] --> PG3["PostgreSQL (only)"]
    end

    Step1 -->|"Verify parity"| Step2
    Step2 -->|"Confirm stable"| Step3
```

### 9.2 localStorage → Dashboard DB

```mermaid
sequenceDiagram
    participant B as Browser
    participant BFF as Dashboard BFF
    participant DB as Dashboard DB

    Note over B: Первый вход после миграции
    B->>BFF: GET /me/dashboard
    BFF-->>B: 404 (нет данных)

    B->>B: Проверить localStorage
    alt Есть данные в localStorage
        B->>BFF: POST /me/migrate {tasks, running, habits, ...}
        BFF->>DB: INSERT user data
        BFF-->>B: 200 {migrated: true}
        B->>B: localStorage.setItem('migrated', 'true')
    end

    Note over B: Последующие входы
    B->>BFF: GET /me/dashboard
    BFF->>DB: SELECT user data
    BFF-->>B: 200 {tasks, running, habits, ...}
```

---

## 10. Оценка рисков

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Увеличение latency (network hops) | Высокая | Среднее | Redis кэш, BFF агрегация |
| Eventual consistency (события) | Высокая | Низкое | Idempotent consumers, retry |
| Операционная сложность | Высокая | Высокое | Observability с Фазы 0, runbooks |
| Потеря данных при миграции БД | Средняя | Высокое | Dual-write, backup перед миграцией |
| Complexity overhead для solo-dev | Высокая | Среднее | Поэтапный подход, не все фазы обязательны |
| Debugging distributed systems | Высокая | Среднее | Distributed tracing, correlation IDs |

---

## 11. Критерии принятия решения о фазах

Не все фазы обязательны. Принимайте решение на основе текущих потребностей:

```mermaid
flowchart TB
    Q1{"Нужна ли<br/>observability?"}
    Q2{"Теряются ли данные<br/>при смене порта?"}
    Q3{"Нужно ли масштабировать<br/>Stats отдельно?"}
    Q4{"Планируется ли<br/>production-деплой?"}

    Q1 -->|"Да"| F0["Фаза 0: Observability"]
    Q1 -->|"Нет"| Q2
    Q2 -->|"Да"| F2["Фаза 2: Dashboard BFF"]
    Q2 -->|"Нет"| Q3
    Q3 -->|"Да"| F3["Фаза 3: CQRS"]
    Q3 -->|"Нет"| Q4
    Q4 -->|"Да"| F4["Фаза 4: Reliability"]
    Q4 -->|"Нет"| STOP["Текущая архитектура<br/>достаточна"]

    F0 --> F1["Фаза 1: Strangler Fig"]
    F1 --> F2
    F2 --> F3
    F3 --> F4
```

**Рекомендация для solo-developer:** Начните с Фазы 0 (observability) и Фазы 2 (Dashboard BFF). Это решает реальные проблемы (потеря данных, отладка) без чрезмерной сложности. Фазы 1, 3, 4 — по мере роста нагрузки или команды.

---

## 12. Глоссарий

| Термин | Определение |
|--------|------------|
| **API Gateway** | Единая точка входа для всех клиентских запросов, выполняющая маршрутизацию, аутентификацию и rate limiting |
| **BFF** | Backend for Frontend — серверный слой, оптимизированный для конкретного UI |
| **Bounded Context** | Граница, в которой определённая модель предметной области применима и консистентна |
| **Circuit Breaker** | Паттерн защиты от каскадных отказов: прерывает вызовы к неисправному сервису |
| **CQRS** | Разделение модели чтения и записи для независимого масштабирования |
| **Event Sourcing** | Хранение состояния как последовательности событий, а не текущего snapshot |
| **Saga** | Паттерн управления распределёнными транзакциями через последовательность локальных транзакций с компенсациями |
| **Strangler Fig** | Постепенная замена монолита микросервисами, перехватывая запросы на уровне proxy |
| **Service Mesh** | Инфраструктурный слой для управления inter-service communication (Istio, Linkerd) |
| **Eventual Consistency** | Гарантия, что все реплики данных со временем станут консистентными |

---

## 13. Рекомендуемая литература

### 13.1 Основная литература

Книги упорядочены от базовых к продвинутым. Каждая покрывает конкретные паттерны из данного плана миграции.

| # | Книга | Автор | Год | Покрывает паттерны | Описание |
|---|-------|-------|-----|-------------------|----------|
| 1 | **Microservices Patterns** | Chris Richardson | 2018 | API Gateway, CQRS, Saga, Event Sourcing, Database per Service, Circuit Breaker, Strangler Fig | Главная книга по теме — содержит все паттерны из этого плана с подробными примерами. Сопровождается онлайн-каталогом [microservices.io](https://microservices.io) |
| 2 | **Building Microservices** (2nd edition) | Sam Newman | 2021 | Decomposition, Service Discovery, BFF, Event-Driven, Strangler Fig | Широкий обзор микросервисной архитектуры от эксперта ThoughtWorks. Второе издание существенно обновлено и актуально |
| 3 | **Designing Data-Intensive Applications** | Martin Kleppmann | 2017 | Event Sourcing, CQRS, Eventual Consistency, Distributed Transactions, Replication, Partitioning | Глубокое понимание работы с данными в распределённых системах — фундамент для корректной реализации фаз 1–3 |
| 4 | **Domain-Driven Design Distilled** | Vaughn Vernon | 2016 | Bounded Context, Aggregate, Context Map, Ubiquitous Language | Компактное (150 стр.) введение в DDD — необходимо для правильной декомпозиции монолита на сервисы |

### 13.2 Дополнительная литература

| # | Книга | Автор | Год | Фокус |
|---|-------|-------|-----|-------|
| 5 | **Release It!** (2nd edition) | Michael Nygard | 2018 | Circuit Breaker, Bulkhead, Retry, Timeout, Steady State — все паттерны надёжности из Фазы 4 |
| 6 | **Production-Ready Microservices** | Susan Fowler | 2017 | Observability, health checks, alerting, on-call — практики из Фазы 0 |
| 7 | **Cloud Native Go** | Matthew Titmus | 2021 | Практическая реализация микросервисов на Go: gRPC, service mesh, observability, resilience — ближе всего к стеку данного проекта |

### 13.3 Соответствие книг фазам миграции

```
Фаза 0 (Observability)      → Production-Ready Microservices (Fowler)
                             → Cloud Native Go (Titmus), гл. 11–13

Фаза 1 (Strangler Fig)      → Microservices Patterns (Richardson), гл. 3, 13
                             → Building Microservices (Newman), гл. 3, 5
                             → DDD Distilled (Vernon), гл. 4–7

Фаза 2 (Dashboard BFF)      → Building Microservices (Newman), гл. 14
                             → Microservices Patterns (Richardson), гл. 8

Фаза 3 (CQRS)               → Designing Data-Intensive Applications (Kleppmann), гл. 11–12
                             → Microservices Patterns (Richardson), гл. 7

Фаза 4 (Reliability)        → Release It! (Nygard), гл. 4–5
                             → Cloud Native Go (Titmus), гл. 9–10

Декомпозиция сервисов        → DDD Distilled (Vernon) + Richardson, гл. 2
                             → Building Microservices (Newman), гл. 3
```

### 13.4 Рекомендуемый порядок чтения

```mermaid
flowchart LR
    R["Microservices<br/>Patterns<br/>(Richardson)"] --> K["Designing<br/>Data-Intensive<br/>Applications<br/>(Kleppmann)"]
    K --> V["DDD<br/>Distilled<br/>(Vernon)"]
    V --> N["Building<br/>Microservices<br/>(Newman)"]

    R -.->|"параллельно"| NY["Release It!<br/>(Nygard)"]
    N -.->|"по необходимости"| F["Production-Ready<br/>Microservices<br/>(Fowler)"]
    N -.->|"практика на Go"| T["Cloud Native<br/>Go<br/>(Titmus)"]
```

**Рекомендация:** начать с **Microservices Patterns** (Richardson) — покрывает ~80% паттернов из плана. Затем **Designing Data-Intensive Applications** (Kleppmann) для глубокого понимания работы с данными. Остальные книги — по мере продвижения по фазам миграции.
