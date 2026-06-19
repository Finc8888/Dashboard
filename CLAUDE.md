# CLAUDE.md — Personal Plans and Notes Repository

This file describes the repository structure, owner context, and instructions for the AI assistant when working with the content.

## Communication with Me

Challenge my decisions. If my approach is suboptimal, say so directly with technical rationale. Do not agree just because I said so.

Before showing any result (code, documentation, analysis), score it 1-10. If below 8 — improve it yourself first, then show the final version. Do not show intermediate drafts or mention the score unless asked.

After completing each task, suggest 2-3 concrete next improvements. Prioritize by pattern: if the same action sequence has appeared more than once — propose a skill, subagent, or script to automate it. Otherwise suggest the highest-leverage improvement: code quality, best practices, tooling, or documentation. Keep suggestions brief (one line each), do not implement unless asked.

> Template: `~/code/projects/claude_projects/CLAUDE.template.md` | New project: `/custom-init-claude` | Sync rules: `/custom-sync-claude-rules`

---

## 👤 Owner Context

- **Stack:** PHP / JS / SQL, DDD approaches, unit tests
- **Goal:** Gradual transition to Golang
- **Learning:** Golang (transitioning from PHP), foreign language via Duolingo
- **Reading:** List of 10 books (Ted Chiang → Le Guin → Lem → Hofstadter) — see `reading/list.md`
- **Activities:** Early start at 7:00, Evening run 19:00–20:00, Duolingo 20:00–21:00

---

## 📁 Repository Structure

```
/
├── CLAUDE.md                  # This file
├── ARCHITECTURE.md            # Full system architecture (C4, networks, routes, localStorage)
├── PRODUCTIVITY_PLAN.md       # Main productivity plan, schedule, methodologies
├── README.md                  # Quick start, overview, Make commands
├── docs/
│   ├── auth-architecture.md   # Unified authentication architecture
│   └── MICROSERVICES_MIGRATION.md  # Microservices migration plans
├── DashboardCaddyfile         # Internal Caddyfile for Dashboard
├── ~/excalidraw/              # Architecture diagrams (outside repo)
│   └── dashboard-ui-architecture.excalidraw.json  # Dashboard UI architecture
├── www/
│   ├── index.html             # SPA: auth overlay + main content
│   ├── blog-wrapper.html      # iframe wrapper for blog (Hugo doesn't support nav)
│   ├── 403.html               # 403 page — no access rights to project
│   ├── css/
│   │   ├── core.css           # Variables, animations, grid, header, footer, responsive
│   │   ├── panels.css         # Modals, widget settings, admin
│   │   └── widgets/           # Styles for each widget (per file)
│   ├── img/
│   │   └── logo.png           # Gladys logo (cyborg woman head)
│   └── js/
│       ├── core/
│       │   ├── utils.js           # uid(), escHtml(), todayStr(), showToast()
│       │   ├── widget-manager.js  # WidgetRegistry, registerWidget(), loadWidgetConfig(), applyWidgetConfig()
│       │   ├── projects.js        # Project navigation
│       │   ├── clock-notif.js     # Clock + notifications
│       │   ├── zen-mode.js        # Zen mode, day-off
│       │   ├── keyboard.js        # Hotkeys
│       │   ├── briefing.js        # Morning briefing + retrospective
│       │   └── export-import.js   # exportData(), importData()
│       ├── widgets/               # One widget = one file with registerWidget()
│       │   └── widgets-config.json # Unified widget config (label, zone, storageKeys, defaults)
│       ├── data/
│       │   ├── go-data.js         # Go lessons data
│       │   └── training-data.js   # Training plan + records
│       ├── app.js             # Thin orchestrator (roundRect polyfill)
│       ├── auth.js            # Authentication module
│       └── word-of-day.js     # Word of the day
├── tests/                     # Jest UI tests for Dashboard (make test)
│   ├── Dockerfile             # Docker container for tests
│   ├── package.json           # Jest + jsdom dependencies
│   └── src/                   # Tests (core/, widgets/)
├── plans/
│   ├── productivity.md        # Main productivity plan
│   ├── golang-learning.md     # Go learning plan
│   └── weekly/                # Weekly plans
│       └── YYYY-WXX.md
├── notes/
│   ├── golang/                # Go notes (concepts, snippets)
│   ├── php/                   # PHP notes / current tasks
│   └── ideas/                 # Ideas and creative thoughts
├── journal/
│   └── YYYY-MM-DD.md          # Daily tracking
└── reading/
    ├── list.md                # Reading list with progress tracker + collection/trilogy contents
    └── notes/                 # Book notes
```

---

## 📝 File Formats

### Daily Journal (`journal/YYYY-MM-DD.md`)

```markdown
# YYYY-MM-DD

## ✅ Main Task of the Day
- [ ] ...

## 📗 Go Today
Topic: ...
Written: ... lines / scripts

## 🏃 Running
- [ ] Completed

## 📱 Duolingo
- [ ] Completed

## 📖 Reading
Book: ...
Up to page: ...

## 🧠 Energy Level (1–10)
...

## 💬 Notes
...
```

### Weekly Plan (`plans/weekly/YYYY-WXX.md`)

```markdown
# Week XX — YYYY

## 🎯 Weekly Goals
1. ...

## 🔴 Work Tasks
- [ ] ...

## 📗 Go
- [ ] ...

## 🔁 Retrospective (fill on Friday)
- What's done:
- What blocked:
- What to change:
```

---

## 🤖 Instructions for Claude

### General Tone and Approach
- Respond in **English** unless specified otherwise.
- Be concrete and practical — no fluff.
- Consider context: limited time (1–2 hours of deep work per day), PHP → Go transition.

### When Working with Plans
- Do not add new activities without request — the schedule is already tight.
- When adjusting the schedule — keep fixed slots: run 19–20, Duolingo 20–21, Reading 21:15–22:30.
- Formulate tasks concretely: not "figure out Go", but "write an HTTP handler in Go with routing".

### When Working with Go Notes
- Code examples — always in Go (not PHP), but can add a PHP parallel comment if the concept is new.
- Stick to idiomatic Go: interfaces, composition over inheritance, explicit error handling.
- Translate DDD patterns into Go structures (don't carry PHP architecture directly).

### When Working with the Journal
- Help fill, analyze patterns, notice progress.
- If energy is below 5 for several days in a row — suggest reviewing the load, not adding more.

### When Working with Authentication and Authorization
- Auth Gateway — separate project in `../Auth-Gateway/`.
- Unified docker-compose runs everything: `make up` (core) or `make up-all` (all projects).
- JWT is stored in HttpOnly cookie `auth_token` — not in localStorage.
- Roles: `admin` (full access + admin panel), `user` (only Dashboard + projects).
- Downstream services receive `X-Auth-User` / `X-Auth-Role` / `X-Auth-Username` from Caddy forward_auth.
- All downstream projects store `auth_user_id` to link data to the Auth Gateway user.
- Gladys Jobs: directories (Companies, Skills) — admin only; vacancies — linked to user_id.
- Gladys Chat: chats linked via `auth_user_id`.
- Upon user deletion: Auth Gateway does soft delete + deletes sessions; in Gladys Jobs vacancies remain (ON DELETE SET NULL).

### When Working with Reading and reading/list.md
- Progress tracker — `reading/list.md`: status (⬜/🔄/✅), page, date log.
- Collections and trilogies contain nested lists of works (expandable in UI).
- Link ideas from books with programming and system architecture where appropriate.
- Do not spoil books that haven't been read yet (check status in list).
- The list is fixed, read strictly in order — do not change the sequence.

### When Working with Goals
- Goals are linked to month and year (not to fixed 30 days).
- Recurring goals (e.g., "Early start at 7 AM") are automatically carried over every month.
- Unfinished goals are automatically carried over to the next period.
- Archive stores goal history from past periods.

### When Working with Widgets
- **MANDATORY** read `docs/widget-guide.md` — it describes structure, patterns, checklist and test requirements for widgets.
- Every widget mutation function **must** call render after saving data (render-after-save pattern).
- When creating a new widget — follow the checklist in `docs/widget-guide.md`, including writing tests.

### When Changing Dashboard Code (www/)
- **MANDATORY** after changes in `www/js/app.js`, `www/index.html` or `www/css/style.css`, check the relevance of:
  - `ARCHITECTURE.md` — section 6 (Dashboard components, localStorage schema).
  - `CLAUDE.md` — repository structure (if files are added/removed).
  - `PRODUCTIVITY_PLAN.md` — if goals, schedule or metrics change.
  - `reading/list.md` — if the reading list or its structure changes.
  - `README.md` — if the project file structure changes.
- When adding a new key to localStorage — update the table in ARCHITECTURE.md section 6.4.
- When adding/removing a widget — update the mindmap in ARCHITECTURE.md section 6.3.
- Ensure that export/import (`exportData`/`importData`) correctly handles all localStorage keys.

### When Changing Approaches to Creating Widgets or Projects
- If the order of steps changed, a new pitfall appeared, or an old approach became obsolete:
  - `docs/widget-guide.md` — update if widget structure changes: `widgets-config.json`, `registerWidget`, `reorderWidgets`, `applyWidgetVisibility`, localStorage pattern, export/import.
  - `docs/project-registration-guide.md` — update if `PROJECTS`, `PROJECT_PERMISSIONS`, Caddyfile scheme for projects, or Auth Gateway permission pattern changes.
  - `docs/new-project-guide.md` — update if the typical stack for a new project changes (Go structure, MobX patterns, DB scheme, Auth Gateway integration, Caddy routes).
- When adding a new project to `PROJECTS` — ensure it is documented in `ARCHITECTURE.md`.

---

## 🌐 Gladys Project Ecosystem

All projects are located in `~/code/projects/` and are united under the **Gladys** brand. Gladys Dashboard is the central hub, and other projects are accessible through it.

### Branding
- **Logo:** `www/img/logo.png` — cyborg woman head (common for all projects).
- Logo is stored **only** in the main Dashboard project; sub-projects link to `/img/logo.png` (absolute path via Caddy gateway).
- Logo in sub-projects is a clickable link to `/` (return to Dashboard), replacing the "← Dashboard" button.
- **Heading Font:** [Orbitron](https://fonts.google.com/specimen/Orbitron) (Google Fonts), gradient cyan→purple.
- **Brand Colors:** cyan `#06b6d4`, purple `#a78bfa`, blue `#3b82f6`.

### Projects and Local Paths

| Project | UI Name | Motto | Local Path | Stack |
|--------|------------|-------|----------------|------|
| **Dashboard** | Gladys Dashboard | Everything needed nearby | `~/code/projects/Productivity/` | Vanilla JS, Caddy |
| **Auth Gateway** | Admin Panel | Keys to all doors | `~/code/projects/Auth-Gateway/` | Go, JWT, Caddy forward_auth |
| **Chat** | Gladys Chat | Words under lock | `~/code/projects/Gladys-Chat/` | Go, React (MobX), WebSocket, E2EE |
| **Jobs** | Gladys Jobs | Every step counts | `~/code/projects/job-statistics-platform/` | Go API, React (MobX), MySQL |
| **Blog** | Gladys Blog | Thoughts take shape | `~/code/projects/Gladys-Blog/` | Hugo, Nginx, Docker |
| **Blog Admin** | Gladys Blog Admin | Behind the scenes of words | `~/code/projects/Gladys-Blog/blog-admin/` | Vanilla JS |
| **Sketchbook** | Gladys Sketchbook | Space for inspiration | `~/code/projects/sketchbook/` | React (MobX), Go API |

### Project Connections
- All projects are proxied through **Caddy** (config in Productivity).
- Authentication is handled by **Auth Gateway** (`forward_auth`).
- Each downstream project receives headers `X-Auth-User` / `X-Auth-Role` / `X-Auth-Username`.
- When working with a specific project — navigate to its directory.
- Logo and Orbitron font are connected in all projects.

---

## 🚫 What NOT to do

- Do not suggest adding YouTube / news to the schedule.
- Do not increase the number of tasks per day — better fewer, but completed.
- Do not overcomplicate the notes structure — simplicity is more important than completeness.
- Do not switch to English without an explicit request.
