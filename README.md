# Productivity Dashboard — Unified Platform

Центральный дашборд продуктивности + единая точка входа для всех локальных проектов с аутентификацией.

## Обзор

- **Dashboard** — визуализация расписания, прогресса Go, целей, счётчиков
- **Auth Gateway** — централизованная аутентификация (JWT, RBAC)
- **Project Hub** — все проекты доступны через единый Caddy Gateway

## Быстрый старт

```bash
cp .env.example .env
# Задать JWT_SECRET и остальные переменные

make up        # Core: Dashboard + Auth Gateway + Caddy
make up-all    # Все проекты: + Blog + Job Statistics
```

Дашборд: **http://localhost**

## Архитектура

```
Браузер → Caddy Gateway (:80)
              │
              ├── forward_auth → Auth Gateway (JWT проверка)
              │                   ↓
              │            X-Auth-User / X-Auth-Role
              │
              ├── /              → Dashboard (static)
              ├── /api/auth/*    → Auth Gateway
              ├── /api/admin/*   → Auth Gateway
              ├── /admin/*       → Auth Gateway (Admin Panel)
              ├── /blog/*        → Gladys Blog (Hugo + Nginx)
              └── /jobs/*        → Job Statistics (React + Go)
```

## Сервисы

| Сервис | Путь | Описание |
|--------|------|----------|
| Dashboard | `/` | Основной дашборд (Caddy + static HTML/JS) |
| Auth Gateway | `/api/auth/*`, `/api/admin/*` | Аутентификация, JWT, управление пользователями |
| Admin Panel | `/admin/` | Управление пользователями и аудит (role: admin) |
| Gladys Blog | `/blog/` | Блог на Hugo (profile: blog) |
| Job Statistics | `/jobs/` | Статистика вакансий (profile: jobs) |

## Make-команды

```bash
make up          # Core: Dashboard + Auth Gateway
make up-all      # Все сервисы
make up-blog     # Core + Blog
make up-jobs     # Core + Job Statistics
make down        # Остановить все контейнеры
make logs        # Логи в реальном времени
make status      # Статус контейнеров
make clean       # Остановить + удалить volumes
```

## Аутентификация

- Первый пользователь регистрируется через форму на Dashboard
- Seed-данные создают admin: `admin@example.com` / `changeme123`
- JWT в HttpOnly cookie — SSO между всеми проектами
- Роли: `admin` (+ админка), `user` (Dashboard + проекты)
- Downstream-сервисы получают `X-Auth-User` / `X-Auth-Role` от Caddy

## Добавление нового проекта

1. Добавить сервис в `docker-compose.yaml` (сеть `gateway`)
2. Добавить `handle /newproject/*` в `Caddyfile`
3. Добавить объект в массив `PROJECTS` в `www/js/app.js`

Изменения в Auth Gateway не требуются.

## Структура

```
.
├── Caddyfile              # Единый Caddy Gateway
├── DashboardCaddyfile     # Внутренний Caddyfile для Dashboard
├── docker-compose.yaml    # Все сервисы (с profiles)
├── Makefile
├── .env.example
├── CLAUDE.md              # Инструкции для AI-ассистента
├── ARCHITECTURE.md        # Полная архитектура (C4, localStorage, компоненты)
├── PRODUCTIVITY_PLAN.md   # План продуктивности, расписание, методики
├── docs/
│   ├── auth-architecture.md
│   └── MICROSERVICES_MIGRATION.md
├── www/
│   ├── index.html         # SPA Dashboard
│   ├── blog-wrapper.html  # iframe-обёртка для блога
│   ├── css/style.css      # Стили
│   └── js/
│       ├── app.js         # Виджеты, TODO, цели, статистика, чтение
│       ├── auth.js        # Аутентификация
│       └── word-of-day.js # Слово дня
├── scripts/
│   └── parse_quotes.py
├── plans/
├── notes/
├── journal/
└── reading/
    └── list.md            # Список чтения с содержанием сборников/трилогий
```
