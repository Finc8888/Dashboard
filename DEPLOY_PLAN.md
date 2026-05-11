# DEPLOY_PLAN — Варианты деплоя на VPS (Ubuntu)

## Текущая архитектура

Проект уже контейнеризирован через `docker-compose.yaml`:
- **Gateway** — Caddy (reverse proxy, forward_auth)
- **Dashboard** — статика (Caddy)
- **Auth-Gateway** — Go-бэкенд + MySQL
- **Опциональные профили:** Blog, Job Statistics, Chat (каждый со своим фронтом/API/БД)
- Зависимости вне репозитория: `../Auth-Gateway/`, `../Gladys-Blog/`, `../job-statistics-platform/`, `../Gladys-Chat/`

---

## Вариант 1: Ручной деплой (git pull + docker compose)

**Суть:** SSH на VPS, клонируешь репозитории, запускаешь `docker compose up -d`.

### Шаги
1. Установить на VPS: Docker, Docker Compose, Git
2. Склонировать все репозитории в одну директорию (сохранить структуру `../Auth-Gateway/` и т.д.)
3. Скопировать `.env` с секретами на сервер
4. Настроить Caddyfile для реального домена (заменить `auto_https off` / `:80` на домен)
5. `make up` или `make up-all`

### Плюсы
- Минимум настройки, работает уже сейчас
- Полный контроль

### Структура на VPS

```
/opt/productivity/
├── Productivity/                    # Главный репозиторий (точка входа)
│   ├── docker-compose.yaml          # Оркестрация всех сервисов
│   ├── Caddyfile                    # Gateway: роутинг, forward_auth, SSL
│   ├── DashboardCaddyfile           # Внутренний Caddy для статики
│   ├── Makefile                     # make up / make up-all / make down
│   ├── .env                         # Секреты (НЕ в git)
│   └── www/                         # Статика Dashboard
│       ├── index.html
│       ├── blog-wrapper.html
│       ├── css/style.css
│       └── js/
│           ├── auth.js
│           ├── app.js
│           ├── training-data.js
│           └── word-of-day.js
│
├── Auth-Gateway/                    # Аутентификация (JWT, роли)
│   ├── backend/                     # Go API (build в docker-compose)
│   │   └── migrations/              # SQL-миграции (init auth-db)
│   ├── frontend/                    # Admin panel UI
│   └── Caddyfile.prod               # Продакшн Caddyfile
│
├── Gladys-Blog/                     # Блог (профиль: blog)
│   ├── blog/                        # Контент блога
│   ├── Dockerfile                   # Сборка
│   └── deploy/                      # Скрипты деплоя
│
├── Gladys-Chat/                     # Чат (профиль: chat)
│   ├── backend/                     # Go API + миграции
│   │   └── migrations/
│   └── frontend/                    # UI чата
│
└── job-statistics-platform/         # Статистика вакансий (профиль: jobs)
    ├── backend/                     # Go API
    │   └── scripts/init.sql         # Инициализация БД
    └── frontend/                    # React UI
```

### Docker-контейнеры после `make up-all`

```
CONTAINER          IMAGE             PORT      СЕТЬ
gateway            caddy:2-alpine    80, 443   gateway
dashboard          caddy:2-alpine    —         gateway
auth-gateway       (build)           8080      gateway, auth-internal
auth-admin         (build)           80        gateway
auth-db            mysql:8.0         3306      auth-internal
gladys-blog        (build)           443       gateway
gladys-chat-frontend (build)         80        gateway
gladys-chat-api    (build)           8082      gateway, chat-internal
gladys-chat-db     mysql:8.0         3306      chat-internal
job-stats-frontend (build)           3000      gateway
job-stats-api      (build)           8081      gateway, jobs-internal
job-stats-db       mysql:8.0         3306      jobs-internal
```

### Минусы
- Каждый деплой вручную: SSH → git pull → docker compose up --build
- Нет автоматизации, легко забыть шаг
- Нет rollback-механизма

### Сложность: ⭐ (минимальная)

---

## Вариант 2: Деплой через SSH-скрипт (push-based)

**Суть:** Локальный bash-скрипт, который по SSH выполняет pull + rebuild на VPS.

### Шаги
1. Базовая настройка как в Варианте 1
2. Создать `scripts/deploy.sh`:
   ```bash
   #!/bin/bash
   set -e
   VPS_HOST="user@your-vps-ip"
   VPS_DIR="/opt/productivity"

   ssh $VPS_HOST "cd $VPS_DIR/Productivity && git pull && make up-all"
   ```
3. Добавить в Makefile: `make deploy`

### Плюсы
- Деплой одной командой с локальной машины
- Просто и предсказуемо

### Минусы
- Нет автоматизации при push
- Нужен SSH-доступ с локальной машины
- Нет уведомлений об ошибках

### Сложность: ⭐⭐

---

## Вариант 3: GitHub Actions (CI/CD)

**Суть:** При push в `main` GitHub Actions подключается по SSH к VPS и перезапускает контейнеры.

### Шаги
1. Базовая настройка VPS как в Варианте 1
2. Создать `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - name: Deploy via SSH
           uses: appleboy/ssh-action@v1
           with:
             host: ${{ secrets.VPS_HOST }}
             username: ${{ secrets.VPS_USER }}
             key: ${{ secrets.SSH_KEY }}
             script: |
               cd /opt/productivity/Productivity
               git pull origin main
               docker compose --profile blog --profile jobs --profile chat up -d --build
   ```
3. Добавить секреты в GitHub: `VPS_HOST`, `VPS_USER`, `SSH_KEY`

### Плюсы
- Автоматический деплой при push
- Видна история деплоев в GitHub
- Можно добавить шаги: линтинг, тесты, уведомления

### Минусы
- Билд на VPS (нагрузка на сервер)
- Секреты хранятся в GitHub
- Зависимость от GitHub Actions

### Сложность: ⭐⭐

---

## Вариант 4: GitHub Actions + Docker Registry

**Суть:** CI билдит образы → пушит в registry (GHCR/Docker Hub) → VPS тянет готовые образы.

### Шаги
1. Добавить `Dockerfile` для каждого сервиса (если нет)
2. CI: build + push образов в GitHub Container Registry (ghcr.io)
3. На VPS: `docker compose pull && docker compose up -d`
4. `docker-compose.yaml` использует `image:` вместо `build:`

### Плюсы
- VPS не тратит ресурсы на билд
- Версионирование образов (откат = смена тега)
- Образы переиспользуются между окружениями

### Минусы
- Нужно поддерживать два варианта compose (dev с `build:`, prod с `image:`)
- Дополнительная сложность CI-пайплайна
- Приватный registry нужен для приватных репозиториев

### Сложность: ⭐⭐⭐

---

## Вариант 5: Watchtower (автоматический pull образов)

**Суть:** На VPS крутится Watchtower — мониторит registry и автоматически обновляет контейнеры при появлении нового образа.

### Шаги
1. Настроить CI как в Варианте 4 (билд + push в registry)
2. Добавить Watchtower в `docker-compose.yaml`:
   ```yaml
   watchtower:
     image: containrrr/watchtower
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock
     command: --interval 60 --cleanup
   ```

### Плюсы
- Полностью автоматический деплой: push → CI → registry → Watchtower → обновление
- Не нужен SSH-доступ для деплоя

### Минусы
- Нет контроля над моментом деплоя
- Сложнее дебажить проблемы
- Watchtower имеет доступ к Docker socket (безопасность)

### Сложность: ⭐⭐⭐

---

## Вариант 6: Ansible

**Суть:** Ansible-плейбук описывает полное состояние VPS: пакеты, конфиги, контейнеры.

### Шаги
1. Создать `ansible/` с inventory и playbook
2. Плейбук: установка Docker, клонирование репо, копирование `.env`, запуск compose
3. `ansible-playbook -i inventory deploy.yml`

### Плюсы
- Воспроизводимая настройка VPS с нуля
- Идемпотентность — можно запускать повторно
- Можно управлять несколькими серверами

### Минусы
- Overhead для одного сервера
- Нужно изучить Ansible
- Ещё один инструмент в стеке

### Сложность: ⭐⭐⭐

---

## Вариант 7: Docker Swarm

**Суть:** Инициализировать Swarm на VPS, деплоить через `docker stack deploy`.

### Шаги
1. `docker swarm init` на VPS
2. Адаптировать `docker-compose.yaml` → добавить `deploy:` секции
3. `docker stack deploy -c docker-compose.yaml productivity`

### Плюсы
- Встроенный rolling update
- Healthcheck → автоматический рестарт
- Масштабирование сервисов при необходимости
- Не требует дополнительных инструментов (уже в Docker)

### Минусы
- Некоторые фичи compose не работают в Swarm (build, depends_on)
- Нужны pre-built образы (registry обязателен)
- Для одного сервера — overkill

### Сложность: ⭐⭐⭐⭐

---

## Вариант 8: Coolify / CapRover (self-hosted PaaS)

**Суть:** Установить на VPS self-hosted PaaS, который даёт UI для деплоя, домены, SSL.

### Coolify
- Современный self-hosted Heroku/Vercel
- UI для управления сервисами, доменами, SSL
- Поддерживает docker-compose из коробки
- `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`

### CapRover
- Аналог, чуть проще
- Веб-панель + CLI
- Автоматический SSL через Let's Encrypt

### Плюсы
- UI для управления — не нужно помнить команды
- Автоматический SSL, домены, логи
- Webhook-деплой из GitHub

### Минусы
- Сам PaaS потребляет ресурсы (Coolify ~500MB RAM)
- Ещё один слой абстракции
- Может конфликтовать с существующим Caddy (порты 80/443)

### Сложность: ⭐⭐⭐

---

## Сравнительная таблица

| Вариант | Автоматизация | Сложность | Rollback | RAM overhead | Подходит для |
|---------|--------------|-----------|----------|-------------|-------------|
| 1. Ручной | Нет | ⭐ | Нет | 0 | Быстрый старт |
| 2. SSH-скрипт | Полу | ⭐⭐ | Нет | 0 | Один разработчик |
| 3. GitHub Actions | При push | ⭐⭐ | Git revert | 0 | Основной выбор |
| 4. Actions + Registry | При push | ⭐⭐⭐ | По тегу | 0 | Несколько окружений |
| 5. Watchtower | Полная | ⭐⭐⭐ | Нет | ~30MB | Hands-off |
| 6. Ansible | По запуску | ⭐⭐⭐ | Плейбук | 0 | Настройка с нуля |
| 7. Docker Swarm | Rolling | ⭐⭐⭐⭐ | Встроенный | ~100MB | Масштабирование |
| 8. Coolify/CapRover | UI + webhook | ⭐⭐⭐ | UI | ~500MB | Удобство |

---

## Рекомендация

Для одного разработчика с одним VPS оптимальный путь:

**Старт → Вариант 1** (ручной, чтобы убедиться что всё работает на VPS)
**Потом → Вариант 3** (GitHub Actions для автоматизации)

### Что нужно сделать независимо от варианта
1. **Домен** — купить или использовать бесплатный (напр. через DuckDNS)
2. **SSL** — Caddy умеет автоматически через Let's Encrypt (убрать `auto_https off`)
3. **Firewall** — `ufw allow 80,443/tcp`, закрыть остальное
4. **Секреты** — `.env` на сервере, не в git
5. **Бэкапы БД** — cron + `mysqldump` для auth_data, chat_data, jobs_data
6. **Структура на VPS** — все репозитории рядом:
   ```
   /opt/productivity/
   ├── Productivity/        # этот репозиторий
   ├── Auth-Gateway/
   ├── Gladys-Blog/
   ├── Gladys-Chat/
   └── job-statistics-platform/
   ```
