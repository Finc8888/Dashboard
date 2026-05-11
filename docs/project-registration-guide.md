# Руководство: Регистрация нового проекта в Dashboard UI

Пошаговый план добавления нового проекта в панель «Проекты» на Dashboard.

---

## Что такое «проект» в Dashboard

Раздел «Проекты» — горизонтальная навигация под заголовком. Каждый проект — это кнопка со статусом (зелёная/красная точка), иконкой и описанием. При клике открывается URL проекта. Статус проверяется автоматически каждые 30 секунд через `fetch`.

---

## Шаг 1 — Добавить проект в массив `PROJECTS`

Файл: `www/js/app.js`, массив `PROJECTS` (~строка 607).

```js
const PROJECTS = [
  // ... существующие проекты ...
  {
    id:    'my-project',          // уникальный идентификатор (kebab-case)
    label: 'My Project',          // название в навигации
    icon:  '🚀',                  // эмодзи-иконка
    url:   '/my-project/',        // URL под Caddy (путь, не домен)
    desc:  'Go API · React',      // короткое описание (стек/назначение)
  },
];
```

После добавления объект сразу попадёт в список для всех пользователей с нужным разрешением.

---

## Шаг 2 — Добавить разрешение в `PROJECT_PERMISSIONS`

Файл: `www/js/app.js`, объект `PROJECT_PERMISSIONS` (~строка 654).

```js
const PROJECT_PERMISSIONS = {
  // ... существующие проекты ...
  'my-project': 'my-project',   // id проекта → имя разрешения
};
```

Значение — это строка-разрешение из JWT-токена пользователя (поле `permissions[]`). Если проект должен быть виден **всем** авторизованным пользователям — не добавляй запись в `PROJECT_PERMISSIONS` (или выдай разрешение всем пользователям через Auth Gateway).

Если проект только для `admin` — используй `'my-project': 'admin'`.

---

## Шаг 3 — Выдать разрешение пользователям в Auth Gateway

Файл: `../Auth-Gateway/` — через административную панель `/admin/`.

1. Открыть `/admin/` → Users
2. Найти нужного пользователя → Edit
3. В поле `Permissions` добавить строку `my-project`
4. Сохранить

После этого при следующем входе JWT будет содержать новое разрешение и проект появится в навигации.

---

## Шаг 4 — Настроить Caddy

Файл: `Caddyfile` в корне репозитория.

Добавить маршрут для нового проекта. Пример для Go-бэкенда:

```caddyfile
handle /my-project/* {
    forward_auth auth:8080 {
        uri /validate
        copy_headers X-Auth-User X-Auth-Role X-Auth-Username X-Auth-Permissions
    }
    reverse_proxy my-project-backend:8080
}
```

Важно:
- `copy_headers` — обязательно копировать все 4 заголовка
- Маршрут должен стоять **до** catch-all маршрута (`handle { ... }`)
- Порт контейнера должен совпадать с внутренним портом сервиса

---

## Шаг 5 — Добавить сервис в `docker-compose.yaml`

Если проект новый и ещё не запущен в Docker:

```yaml
my-project-backend:
  build: ../my-project/backend
  container_name: my-project-backend
  environment:
    - DB_HOST=my-project-db
    - DB_USER=myuser
    - DB_PASSWORD=mypassword
    - DB_NAME=myproject
  depends_on:
    - my-project-db
  networks:
    - web

my-project-db:
  image: mysql:8
  container_name: my-project-db
  environment:
    MYSQL_ROOT_PASSWORD: rootpass
    MYSQL_DATABASE: myproject
    MYSQL_USER: myuser
    MYSQL_PASSWORD: mypassword
  volumes:
    - my-project-db-data:/var/lib/mysql
  networks:
    - web
```

Сети: все сервисы должны быть в одной сети с `auth` и `caddy`.

---

## Шаг 6 — Добавить Makefile-команды (опционально)

Файл: `Makefile`

```makefile
up-my-project:
	docker compose up -d my-project-backend my-project-db

down-my-project:
	docker compose down my-project-backend my-project-db

logs-my-project:
	docker compose logs -f my-project-backend
```

---

## Итоговый чеклист

- [ ] `PROJECTS` — добавлен объект `{ id, label, icon, url, desc }`
- [ ] `PROJECT_PERMISSIONS` — добавлено разрешение (или не добавлено, если публичный)
- [ ] Auth Gateway — разрешение выдано нужным пользователям
- [ ] `Caddyfile` — маршрут с `forward_auth` и `copy_headers`
- [ ] `docker-compose.yaml` — сервис добавлен в нужный compose-файл
- [ ] Makefile — команды для удобства (опционально)

---

## Подводные камни

**1. Порядок маршрутов в Caddy**
Caddy использует first-match для `handle`. Новый маршрут должен стоять **до** общего `handle { }`. Если поставить после — запросы к `/my-project/` уйдут в fallback.

**2. `copy_headers` в `forward_auth`**
Без этого блока downstream-сервис не получит `X-Auth-User` и `X-Auth-Role`. Backend не сможет определить пользователя, все запросы будут анонимными.

**3. Разрешение в JWT не обновляется сразу**
JWT живёт до истечения срока. Чтобы изменения разрешений вступили в силу — пользователь должен перелогиниться (или admin может инвалидировать сессию через `/admin/`).

**4. Статус-индикатор всегда «offline»**
`checkProject` делает `fetch(project.url)`. Если контейнер не запущен или маршрут Caddy неправильный — точка красная. Проверить: `docker ps` и `curl -I http://localhost/my-project/`.

**5. Проект виден но недоступен (401/403)**
`checkProject` считает `r.status === 401` как «online» — это нормально для защищённых маршрутов. Если статус 403 — Caddy вернул ошибку авторизации, значит `forward_auth` отклонил запрос.

**6. Значение `url` должно заканчиваться на `/`**
Без завершающего слеша часть SPA-роутеров некорректно обрабатывает базовый путь.
