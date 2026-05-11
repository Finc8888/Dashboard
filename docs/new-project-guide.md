# Гайд: Создание нового проекта для Dashboard UI

Пошаговая инструкция по созданию типичного fullstack-проекта в экосистеме Dashboard UI.

**Стек:** Go (Gorilla Mux) · React + TypeScript + MobX + esbuild · MySQL · Docker Compose · Caddy

---

## Структура проекта

```
/home/friedfox/code/projects/<name>/
├── backend/
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── handlers/
│   │   ├── middleware/auth.go
│   │   ├── models/models.go
│   │   └── repository/
│   ├── scripts/init.sql
│   ├── migrations/
│   ├── go.mod
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/Layout.tsx
    │   ├── pages/
    │   ├── stores/RootStore.ts
    │   ├── services/api.ts
    │   └── types/index.ts
    ├── public/index.html
    ├── Caddyfile
    ├── package.json
    ├── tsconfig.json
    ├── build.js
    └── Dockerfile
```

---

## Шаг 1 — Бэкенд: модели и репозиторий

### 1.1 `internal/models/models.go`

```go
package models

import "time"

type MyEntity struct {
    ID        int       `json:"id"`
    UserID    int       `json:"user_id"`
    Title     string    `json:"title"`
    Tags      string    `json:"tags"`
    SourceURL string    `json:"source_url"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

> Все строковые поля — `string` (не `*string`). NULL из БД вызовет ошибку scan — см. раздел «Подводные камни».

### 1.2 `internal/repository/entity_repository.go`

Обязательный набор методов:
- `GetAllByUserID(userID int)`
- `GetAll()`
- `GetByID(id int)`
- `Create(e *models.MyEntity)`
- `Update(e *models.MyEntity)`
- `Delete(id int)`

Интерфейс для моков и хэндлеров:

```go
type MyEntityRepositoryInterface interface {
    GetAllByUserID(userID int) ([]models.MyEntity, error)
    GetAll() ([]models.MyEntity, error)
    GetByID(id int) (*models.MyEntity, error)
    Create(e *models.MyEntity) error
    Update(e *models.MyEntity) error
    Delete(id int) error
}
```

### 1.3 SQL: таблица в `scripts/init.sql`

```sql
CREATE TABLE IF NOT EXISTS my_entities (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    title      VARCHAR(255) NOT NULL,
    tags       VARCHAR(500) NOT NULL DEFAULT '',
    source_url VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);
```

> Короткие поля (VARCHAR) — `NOT NULL DEFAULT ''`. Текстовые поля (TEXT) — без DEFAULT, и это нормально.

---

## Шаг 2 — Бэкенд: хэндлеры

### 2.1 Паттерн owner-or-admin

Каждый пользователь видит только свои данные; admin видит всё:

```go
func (h *Handler) GetAll(w http.ResponseWriter, r *http.Request) {
    userID := middleware.GetUserID(r)
    role   := middleware.GetUserRole(r)

    var items []models.MyEntity
    var err   error

    if userID == 0 || role == "admin" {
        items, err = h.repo.GetAll()
    } else {
        items, err = h.repo.GetAllByUserID(userID)
    }
    // ...
}
```

### 2.2 Хелпер `ownerOrAdmin`

```go
// internal/handlers/helpers.go
func ownerOrAdmin(w http.ResponseWriter, r *http.Request, ownerID int) bool {
    userID := middleware.GetUserID(r)
    role   := middleware.GetUserRole(r)
    if role == "admin" || userID == ownerID {
        return true
    }
    writeError(w, http.StatusForbidden, "Нет доступа")
    return false
}
```

Использовать в GetByID, Update, Delete.

### 2.3 Create — правильное возвращение объекта

После `repo.Create(&entity)` объект содержит только `ID` от `LastInsertId`. Дата `created_at` и другие DEFAULT-поля отсутствуют. Если они нужны на фронте — нужно делать `repo.GetByID` и возвращать полный объект, либо просто возвращать структуру как есть (фронт обработает нулевые значения).

---

## Шаг 3 — Бэкенд: middleware и main

### 3.1 Скопировать `middleware/auth.go` из существующего проекта

Middleware читает заголовки `X-Auth-User`, `X-Auth-Role`, `X-Auth-Username` от Caddy и кладёт userID/role в контекст. Один в один копируется из `sketchbook` или `jobs`.

### 3.2 `cmd/api/main.go`

```go
r := mux.NewRouter()
r.Use(middleware.AuthMiddleware(userRepo))

api := r.PathPrefix("/api/v1").Subrouter()
api.HandleFunc("/entities",      h.GetAll).Methods("GET")
api.HandleFunc("/entities",      h.Create).Methods("POST")
api.HandleFunc("/entities/{id}", h.GetByID).Methods("GET")
api.HandleFunc("/entities/{id}", h.Update).Methods("PUT")
api.HandleFunc("/entities/{id}", h.Delete).Methods("DELETE")
```

### 3.3 Подключение к MySQL

```go
dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
    os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
    os.Getenv("DB_HOST"), os.Getenv("DB_PORT"),
    os.Getenv("DB_NAME"))
```

`?parseTime=true` — обязательно, иначе `time.Time` не парсится.

---

## Шаг 4 — Фронтенд

### 4.1 `public/index.html`

```html
<script src="bundle.js"></script>
```

> **ВАЖНО:** путь к `bundle.js` должен быть **относительным** (`bundle.js`), не абсолютным (`/bundle.js`). При размещении под `/myproject/`, абсолютный путь ведёт на Dashboard-контейнер.

### 4.2 `types/index.ts`

Повторяет поля Go-модели. Числа (`int`) → `number`, строки → `string`, время → `string` (ISO).

### 4.3 `stores/RootStore.ts` с MobX

```ts
import { makeAutoObservable, runInAction } from 'mobx';

class RootStore {
  items: MyEntity[] = [];
  loading = false;

  constructor() { makeAutoObservable(this); }

  async fetchItems() {
    this.loading = true;
    try {
      const res = await itemApi.getAll();
      runInAction(() => { this.items = res.data; this.loading = false; });
    } catch {
      runInAction(() => { this.loading = false; });
    }
  }

  async createItem(data: Partial<MyEntity>) {
    const res = await itemApi.create(data);
    runInAction(() => { this.items.unshift(res.data); });
    return res.data;
  }
  // updateItem, deleteItem — аналогично
}
```

### 4.4 Фильтрация и поиск в списках — без `useMemo`

```tsx
// ПРАВИЛЬНО — вычислять напрямую, без useMemo
const q = search.toLowerCase();
const filtered = rootStore.items.filter(item =>
  !q || (item.title || '').toLowerCase().includes(q)
);
```

> **ВАЖНО:** `useMemo([rootStore.items, ...])` не сработает корректно — MobX observable array сохраняет ту же ссылку при `unshift`/`push`, поэтому React считает зависимость неизменной и возвращает кеш. Новые элементы не отображаются, хотя счётчик (читающий `.length` напрямую) обновится. MobX `observer` сам управляет перерендерами — просто вычисляй inline.

### 4.5 `components/Layout.tsx` — ссылка на Dashboard

```tsx
const isGateway = window.location.pathname.startsWith('/myproject');

// В JSX — первый элемент в шапке:
{isGateway && (
  <a href="/" style={dashboardLinkStyle}>← Dashboard</a>
)}
```

### 4.6 `build.js` (esbuild)

```js
require('esbuild').build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  minify: process.env.NODE_ENV === 'production',
}).catch(() => process.exit(1));
```

---

## Шаг 5 — Docker Compose

В `Productivity/docker-compose.yaml` добавить три сервиса с профилем `<name>`:

```yaml
  <name>-frontend:
    build: ../../../<name>/frontend
    container_name: <name>-frontend
    networks: [caddy-internal, <name>-internal]
    profiles: [<name>]
    restart: unless-stopped

  <name>-api:
    build: ../../../<name>/backend
    container_name: <name>-api
    environment:
      DB_HOST: <name>-db
      DB_PORT: "3306"
      DB_USER: <name>user
      DB_PASSWORD: <name>password
      DB_NAME: <name>
    depends_on:
      <name>-db:
        condition: service_healthy
    networks: [<name>-internal]
    profiles: [<name>]
    restart: unless-stopped

  <name>-db:
    image: mysql:8.0
    container_name: <name>-db
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: <name>
      MYSQL_USER: <name>user
      MYSQL_PASSWORD: <name>password
    volumes:
      - <name>_data:/var/lib/mysql
      - ../../../<name>/backend/scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [<name>-internal]
    profiles: [<name>]
    restart: unless-stopped

networks:
  <name>-internal:
    driver: bridge

volumes:
  <name>_data:
```

> БД порт `3306` пробрасывать наружу только при необходимости отладки — в продакшене не нужен.

---

## Шаг 6 — Caddy: маршруты

В `Productivity/Caddyfile` добавить два блока (до общих маршрутов):

```caddy
# Проверка права доступа
@has_<name>_perm header_regexp X-Auth-Permissions <name>

# API — проксирование на Go-контейнер
handle /name/api/* {
    forward_auth auth-gateway:8080 {
        uri /verify
        copy_headers X-Auth-User X-Auth-Role X-Auth-Username X-Auth-Permissions
    }
    @denied not header_regexp X-Auth-Permissions <name>
    handle @denied { respond "Forbidden" 403 }
    reverse_proxy <name>-api:8084 {
        header_up Host {upstream_hostport}
    }
}

# Frontend — статика
handle /name/* {
    forward_auth auth-gateway:8080 {
        uri /verify
        copy_headers X-Auth-User X-Auth-Role X-Auth-Username X-Auth-Permissions
    }
    @denied not @has_<name>_perm
    handle @denied { redir / 302 }
    reverse_proxy <name>-frontend:80
}
```

---

## Шаг 7 — Auth Gateway: регистрация права

Три места в `Auth-Gateway`:

### 7.1 `backend/internal/handlers/admin.go`

```go
// Найти validPerms map и добавить:
validPerms := map[string]bool{
    // ... существующие ...
    "<name>": true,  // ← добавить
}
```

### 7.2 `backend/internal/handlers/auth.go`

```go
// Найти хардкод прав admin и добавить:
perms = []string{"dashboard", "blog", "jobs", "chat", "admin", "widget_settings", "sketchbook", "<name>"}
```

### 7.3 `frontend/src/admin.js`

```js
const ALL_PERMISSIONS = [
  // ... существующие ...
  { id: '<name>', label: 'MyProject' },  // ← добавить
];
```

После изменений пересобрать и перезапустить `auth-gateway` и `auth-gateway-frontend`.

---

## Шаг 8 — Dashboard UI: карточка проекта

В `Productivity/www/js/app.js` найти массив проектов и добавить:

```js
{ id: '<name>', label: 'My Project', icon: '★', url: '/<name>/', desc: 'Описание' }
```

И в `PROJECT_PERMISSIONS`:

```js
'<name>': '<name>'
```

---

## Шаг 9 — Makefile

В `Productivity/Makefile` добавить:

```makefile
up-<name>:
	docker compose --profile <name> up -d

<name>-migrate:
	docker exec <name>-db mysql -u<name>user -p<name>password <name> < path/to/migration.sql
```

И добавить `--profile <name>` в цели `down`, `up-all`, `logs`, `status`, `clean`.

---

## Шаг 10 — Первый запуск

```bash
# Запустить проект
make up-<name>

# Убедиться что API поднялся
docker logs <name>-api

# Выдать права в панели admin
# Dashboard → Admin → Users → выбрать пользователя → добавить право <name>
```

---

## Подводные камни и нюансы

### БД

**MySQL TEXT не поддерживает DEFAULT**
```sql
-- ОШИБКА:
content TEXT DEFAULT ''
-- ПРАВИЛЬНО:
content TEXT NOT NULL
-- или просто TEXT (nullable, но Go scan вернёт ошибку — см. ниже)
```

**`ALTER TABLE ADD COLUMN IF NOT EXISTS` — только PostgreSQL**
```sql
-- MySQL не поддерживает, просто:
ALTER TABLE t ADD COLUMN year INT NOT NULL DEFAULT 0;
```

**NULL в строковых полях — ошибка scan в Go**
Go's `database/sql` не умеет сканировать NULL в `string`. Если поле nullable — объявляй `*string` в модели или всегда используй `NOT NULL DEFAULT ''`. Иначе любая строка с NULL вызовет 500 на всём эндпоинте.

**init.sql применяется только при первом старте контейнера**
Если том уже существует — init.sql игнорируется. Для изменений схемы — всегда создавай файл миграции и применяй вручную:
```bash
docker exec <name>-db mysql -u<name>user -p<name>password <name> < migrations/002_add_field.sql
```

---

### Auth Gateway

**Три места при регистрации нового права**
Пропуск любого из трёх вызывает разные симптомы:
- Пропуск `admin.go` validPerms → «Invalid permission» при сохранении в UI
- Пропуск `auth.go` admin perms → 403 у admin-пользователя (его права берутся из хардкода)
- Пропуск `admin.js` ALL_PERMISSIONS → право недоступно в dropdown UI

После изменений в Auth Gateway — **пересобрать оба контейнера** (`auth-gateway` и `auth-gateway-frontend`).

---

### Фронтенд

**Относительный путь к bundle.js**
```html
<!-- ПРАВИЛЬНО -->
<script src="bundle.js"></script>

<!-- СЛОМАЕТ при размещении под /myproject/ — браузер запросит /bundle.js -->
<script src="/bundle.js"></script>
```

**MobX + useMemo: элементы не появляются после создания**
MobX observable arrays мутируются in-place (`unshift`, `push`) — ссылка на массив не меняется. React's `useMemo` не пересчитывает результат при той же ссылке, даже если содержимое изменилось. Счётчик (`rootStore.items.length`) обновляется, список — нет.

**Решение:** не использовать `useMemo` для фильтрации. Вычислять `filtered` напрямую в теле компонента — MobX `observer` сам решает, когда рендерить.

**Null-safety в строковых операциях**
API может вернуть `null` для необязательных полей. Всегда используй защитный паттерн:
```ts
(item.author || '').toLowerCase()
(item.tags || '').split(',')
```

**esbuild не проверяет TypeScript-ошибки**
esbuild транспилирует TS → JS без type-checking. Ошибки «Cannot find module 'react'» и «JSX element implicitly has type 'any'» в IDE — это проблема tsconfig, не сборки. Проект соберётся и запустится.

---

### Docker Compose

**Порядок объявления profiles**
Цели `down`, `logs`, `status` должны явно включать `--profile <name>`, иначе контейнеры проекта не войдут в операцию.

**Healthcheck на БД обязателен**
Без `depends_on` с `condition: service_healthy` API-контейнер стартует раньше БД и падает с «connection refused». MySQL поднимается ~5-10 секунд.

**init.sql разбивается на файл per-table**
Если одна команда в init.sql падает (например, TEXT DEFAULT ''), вся инициализация прерывается и часть таблиц не создаётся. Проверяй после первого старта:
```bash
docker exec <name>-db mysql -u<name>user -p<name>password <name> -e "SHOW TABLES;"
```

---

### Caddy

**Порядок маршрутов важен**
Блок `/name/api/*` должен быть **выше** `/name/*`, иначе API-запросы уйдут на фронтенд-контейнер.

**`copy_headers` в forward_auth**
Без явного `copy_headers` заголовки `X-Auth-*` не прокидываются в downstream. Go-сервис не увидит userID и будет работать в «анонимном» режиме (userID = 0).

---

## Чеклист быстрого старта

- [ ] Создана структура директорий
- [ ] `models.go` — все поля NOT NULL или с DEFAULT
- [ ] `repository` — интерфейс + реализация
- [ ] `middleware/auth.go` скопирован
- [ ] `cmd/api/main.go` — роуты зарегистрированы
- [ ] `scripts/init.sql` — таблицы без `TEXT DEFAULT ''`
- [ ] `public/index.html` — `bundle.js` (относительный путь)
- [ ] `filtered` в компонентах — без `useMemo`
- [ ] `Layout.tsx` — ссылка `← Dashboard` первым элементом
- [ ] `docker-compose.yaml` — три сервиса с профилем
- [ ] `Caddyfile` — два блока (api + frontend), api выше
- [ ] `auth-gateway/admin.go` — добавлено в `validPerms`
- [ ] `auth-gateway/auth.go` — добавлено в admin perms
- [ ] `auth-gateway/admin.js` — добавлено в `ALL_PERMISSIONS`
- [ ] Auth Gateway пересобран
- [ ] `app.js` Dashboard — карточка проекта + `PROJECT_PERMISSIONS`
- [ ] `Makefile` — цель `up-<name>` и `--profile` в общих целях
- [ ] После запуска: проверить `docker logs <name>-db` и `<name>-api`
- [ ] Выдать права в admin-панели
