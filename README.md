# Gladys Dashboard — Unified Platform

Central productivity dashboard + single entry point for all local projects with unified authentication.

## Overview

- **Dashboard** — visualization of schedule, Go progress, goals, and counters.
- **Auth Gateway** — centralized authentication (JWT, RBAC).
- **Project Hub** — all projects are accessible via a single Caddy Gateway.

## Quick Start

```bash
cp .env.example .env
# Set JWT_SECRET and other environment variables

make up        # Core: Dashboard + Auth Gateway + Caddy
make up-all    # All projects: + Blog + Job Statistics
```

Dashboard: **http://localhost**

## Architecture

```
Browser → Caddy Gateway (:80)
              │
              ├── forward_auth → Auth Gateway (JWT verification)
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

## Services

| Service | Path | Description |
|--------|------|----------|
| Dashboard | `/` | Main dashboard (Caddy + static HTML/JS) |
| Auth Gateway | `/api/auth/*`, `/api/admin/*` | Authentication, JWT, user management |
| Admin Panel | `/admin/` | User management and audit (role: admin) |
| Gladys Blog | `/blog/` | Hugo-based blog (profile: blog) |
| Job Statistics | `/jobs/` | Vacancy statistics (profile: jobs) |

## Make Commands

```bash
make up          # Core: Dashboard + Auth Gateway
make up-all      # All services
make up-blog     # Core + Blog
make up-jobs     # Core + Job Statistics
make down        # Stop all containers
make logs        # Real-time logs
make status      # Container status
make clean       # Stop + remove volumes

# Dashboard UI: tests
make test              # Jest tests for Dashboard UI (Docker)
make test-coverage     # Tests + coverage

# Job Statistics: rebuild after changes
make jobs-rebuild           # Rebuild API + Frontend (no cache)
make jobs-rebuild-api       # API only
make jobs-rebuild-frontend  # Frontend only
make jobs-logs              # Job Statistics logs

# Job Statistics: tests and linter
make jobs-test-backend      # Go backend unit tests (local)
make jobs-test              # Frontend Jest tests (Docker)
make jobs-test-coverage     # Tests + coverage
make jobs-lint              # ESLint check
make jobs-lint-fix          # ESLint with auto-fix
make jobs-migrate           # Apply DB migrations
make jobs-seed              # Load test data (DESTRUCTIVE)
```

## Authentication

- The first user registers via the form on the Dashboard.
- Seed data creates an admin: `admin@example.com` / `changeme123`.
- JWT in HttpOnly cookie — SSO across all projects.
- Roles: `admin` (+ admin panel), `user` (Dashboard + projects).
- Downstream services receive `X-Auth-User` / `X-Auth-Role` from Caddy.

## Adding a New Project

1. Add the service to `docker-compose.yaml` (network `gateway`).
2. Add `handle /newproject/*` to `Caddyfile`.
3. Add an object to the `PROJECTS` array in `www/js/app.js`.

No changes to Auth Gateway are required.

## Structure

```
.
├── Caddyfile              # Unified Caddy Gateway
├── DashboardCaddyfile     # Internal Caddyfile for Dashboard
├── docker-compose.yaml    # All services (with profiles)
├── Makefile
├── .env.example
├── CLAUDE.md              # Instructions for AI assistant
├── ARCHITECTURE.md        # Full architecture (C4, localStorage, components)
├── PRODUCTIVITY_PLAN.md   # Productivity plan, schedule, methodologies
├── docs/
│   ├── auth-architecture.md
│   └── MICROSERVICES_MIGRATION.md
├── www/
│   ├── index.html         # SPA Dashboard
│   ├── blog-wrapper.html  # iframe wrapper for blog
│   ├── 403.html           # 403 page
│   ├── css/
│   │   ├── core.css       # Variables, grid, header, footer, responsive
│   │   ├── panels.css     # Modals, project navigation, admin
│   │   └── widgets/       # Styles for each widget (per file)
│   └── js/
│       ├── core/          # utils, widget-manager, projects, keyboard, etc.
│       ├── widgets/       # Each widget is a separate file
│       ├── data/          # go-data.js, training-data.js
│       ├── app.js         # Orchestrator
│       ├── auth.js        # Authentication
│       └── word-of-day.js # Word of the day
├── scripts/
│   └── parse_quotes.py
├── plans/
├── notes/
├── journal/
└── reading/
    └── list.md            # Reading list with collection/trilogy contents
```
