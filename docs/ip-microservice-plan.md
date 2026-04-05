# План: Go-микросервис для определения IP пользователя

## Цель

Заменить внешний `api.ipify.org` на свой эндпоинт, чтобы IP отображался во всех браузерах (включая Firefox Private Mode).

---

## Шаги

### 1. Создать Go-проект

- Создать директорию `../IP-Service/` (рядом с Auth-Gateway)
- `go mod init ip-service`
- Один файл `main.go` — минимальный HTTP-сервер

### 2. Реализовать эндпоинт `GET /api/ip`

- Читать IP из заголовков в порядке приоритета:
  1. `X-Forwarded-For` (первый IP в цепочке)
  2. `X-Real-Ip`
  3. `RemoteAddr` (fallback)
- Ответ: `{"ip": "1.2.3.4"}`
- Content-Type: `application/json`

```go
func handleIP(w http.ResponseWriter, r *http.Request) {
    ip := r.Header.Get("X-Forwarded-For")
    if ip == "" {
        ip = r.Header.Get("X-Real-Ip")
    }
    if ip == "" {
        ip, _, _ = net.SplitHostPort(r.RemoteAddr)
    }
    // X-Forwarded-For может содержать цепочку: "client, proxy1, proxy2"
    if i := strings.Index(ip, ","); i != -1 {
        ip = strings.TrimSpace(ip[:i])
    }
    w.Header().Set("Content-Type", "application/json")
    fmt.Fprintf(w, `{"ip":"%s"}`, ip)
}
```

### 3. Dockerfile

```dockerfile
FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod main.go ./
RUN go build -o ip-service .

FROM alpine:3.19
COPY --from=build /app/ip-service /ip-service
EXPOSE 8090
CMD ["/ip-service"]
```

### 4. Добавить в docker-compose.yaml

```yaml
ip-service:
  build: ../IP-Service
  container_name: ip-service
  restart: unless-stopped
  networks: [gateway]
```

### 5. Добавить маршрут в Caddyfile (внешний)

```caddyfile
handle /api/ip {
    reverse_proxy ip-service:8090
}
```

Разместить **до** блока `handle` Dashboard (default), чтобы перехватывался первым.

Auth не нужен — эндпоинт возвращает IP того, кто спрашивает, без чувствительных данных.

### 6. Обновить fetch в auth.js

```js
fetch('/api/ip')
```

Вместо `https://api.ipify.org?format=json` — уже подготовлено, просто поменять URL.

### 7. Проверить

- Chrome обычный / инкогнито
- Firefox обычный / приватный
- `curl http://localhost/api/ip`

---

## Итого

- 1 файл Go (~20 строк)
- 1 Dockerfile
- 2 строки в docker-compose
- 3 строки в Caddyfile
- 1 строка в auth.js
