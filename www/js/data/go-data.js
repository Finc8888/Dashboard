const GO_LESSONS = [
  {
    id: 1,
    title: 'Запуск двух инстансов и первая синхронизация',
    time: '30-40 мин',
    goal: 'Базовый flow Syncthing: сборка, запуск двух нод, синхронизация файла',
    steps: [
      {
        title: 'Сборка из исходников',
        text: 'Клонируем репозиторий и собираем бинарник через Go-скрипт сборки.',
        code: `git clone https://github.com/syncthing/syncthing.git
cd syncthing
go run build.go build syncthing`
      },
      {
        title: 'Создание директорий для двух нод',
        text: 'Создаём отдельные home-директории и папки синхронизации для каждого инстанса.',
        code: `mkdir -p ~/st-lab/node1/config ~/st-lab/node1/sync
mkdir -p ~/st-lab/node2/config ~/st-lab/node2/sync`
      },
      {
        title: 'Запуск node1 (порт 8384)',
        text: 'Запускаем первый инстанс с отдельным home и GUI на порту 8384.',
        code: `./syncthing --home ~/st-lab/node1/config \\
  --gui-address 127.0.0.1:8384 &`
      },
      {
        title: 'Запуск node2 (порт 8385)',
        text: 'Запускаем второй инстанс на другом порту, чтобы оба работали параллельно.',
        code: `./syncthing --home ~/st-lab/node2/config \\
  --gui-address 127.0.0.1:8385 \\
  --device-name node2 &`
      },
      {
        title: 'Получение Device ID',
        text: 'Узнаём ID каждого устройства через CLI и REST API.',
        code: `# CLI
./syncthing --home ~/st-lab/node1/config --device-id

# REST API
curl -s -H "X-API-Key: YOUR_KEY" \\
  http://127.0.0.1:8384/rest/system/status | jq .myID`
      },
      {
        title: 'Настройка через GUI',
        text: 'Открываем оба GUI в браузере, добавляем устройства друг к другу и указываем общую папку.',
      },
      {
        title: 'Проверка синхронизации',
        text: 'Создаём файл на node1 и проверяем появление на node2.',
        code: `echo "Hello Syncthing" > ~/st-lab/node1/sync/test.txt
# Ждём несколько секунд
cat ~/st-lab/node2/sync/test.txt`
      },
      {
        title: 'Наблюдение с STTRACE',
        text: 'Перезапускаем с трассировкой для изучения внутренних процессов.',
        code: `STTRACE=model,connections ./syncthing \\
  --home ~/st-lab/node1/config \\
  --gui-address 127.0.0.1:8384`
      }
    ],
    codeToStudy: ['lib/syncthing/syncthing.go'],
    takeaways: [
      'Каждый инстанс — отдельный --home и порт',
      'Local discovery находит устройства автоматически в LAN',
      'Логи показывают жизненный цикл подключения и синхронизации',
      'STTRACE позволяет фильтровать вывод по подсистемам'
    ]
  },
  {
    id: 2,
    title: 'REST API — управление через код',
    time: '40-50 мин',
    goal: 'REST API Syncthing + написание Go-клиента',
    steps: [
      {
        title: 'Получение API-ключа',
        text: 'API-ключ хранится в config.xml — извлекаем его для аутентификации запросов.',
        code: `grep apikey ~/st-lab/node1/config/config.xml
# <apikey>abc123...</apikey>`
      },
      {
        title: 'Базовые GET-запросы',
        text: 'Проверяем основные эндпоинты: статус, версия, конфигурация, подключения.',
        code: `API="http://127.0.0.1:8384/rest"
KEY="YOUR_API_KEY"

curl -s -H "X-API-Key: $KEY" $API/system/status | jq .myID
curl -s -H "X-API-Key: $KEY" $API/system/version | jq .
curl -s -H "X-API-Key: $KEY" $API/system/config | jq .devices
curl -s -H "X-API-Key: $KEY" $API/system/connections | jq .
curl -s -H "X-API-Key: $KEY" $API/db/status?folder=default | jq .
curl -s -H "X-API-Key: $KEY" "$API/db/browse?folder=default&prefix=" | jq .`
      },
      {
        title: 'Написание Go-клиента',
        text: 'Создаём простой клиент с типизированным ответом и хелпером для запросов.',
        code: `package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type SystemStatus struct {
    MyID        string \`json:"myID"\`
    Uptime      int    \`json:"uptime"\`
    NumFolders  int    \`json:"numFolders"\`
    NumDevices  int    \`json:"numDevices"\`
}

func apiGet(path string, apiKey string, result interface{}) error {
    req, _ := http.NewRequest("GET",
        "http://127.0.0.1:8384/rest/"+path, nil)
    req.Header.Set("X-API-Key", apiKey)

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    body, _ := io.ReadAll(resp.Body)
    return json.Unmarshal(body, result)
}

func main() {
    var status SystemStatus
    if err := apiGet("system/status", "YOUR_KEY", &status); err != nil {
        panic(err)
    }
    fmt.Printf("ID: %s\\nUptime: %ds\\nFolders: %d\\nDevices: %d\\n",
        status.MyID, status.Uptime, status.NumFolders, status.NumDevices)
}`
      },
      {
        title: 'Изучение исходного кода роутов',
        text: 'Находим, как Syncthing регистрирует HTTP-обработчики.',
        code: `grep -rn "router\\|HandleFunc\\|newAPISvc" lib/api/api.go | head -30`
      },
      {
        title: 'Подписка на события (SSE)',
        text: 'Long-polling на события позволяет мониторить изменения в реальном времени.',
        code: `curl -s -H "X-API-Key: $KEY" \\
  "$API/events?since=0&limit=5" | jq .[].type`
      }
    ],
    codeToStudy: ['lib/api/api.go', 'lib/api/api_auth.go', 'lib/events/events.go'],
    takeaways: [
      'API-ключ из config.xml — основная аутентификация',
      'REST API покрывает всё: конфиг, статус, управление папками и устройствами',
      'Go-клиент: структуры + json.Unmarshal — типизированный доступ',
      'События через long-polling — основа для мониторинга'
    ]
  },
  {
    id: 3,
    title: 'Система событий (Events)',
    time: '30 мин',
    goal: 'Паттерн Observer/Pub-Sub на примере events.go',
    steps: [
      {
        title: 'Изучение events.go',
        text: 'EventType использует битовые маски для комбинирования типов событий.',
        code: `// lib/events/events.go
type EventType int64

const (
    Starting EventType = 1 << iota
    StartupComplete
    DeviceDiscovered
    DeviceConnected
    DeviceDisconnected
    // ... каждый тип — степень двойки
    AllEvents = (1 << iota) - 1
)`
      },
      {
        title: 'Наблюдение через API с фильтром',
        text: 'Подписываемся только на события подключения устройств.',
        code: `curl -s -H "X-API-Key: $KEY" \\
  "$API/events?events=DeviceConnected&since=0" | jq .`
      },
      {
        title: 'Мониторинг файловых изменений',
        text: 'Отслеживаем LocalChangeDetected для наблюдения за синхронизацией.',
        code: `# В одном терминале: мониторим события
curl -s -H "X-API-Key: $KEY" \\
  "$API/events?events=LocalChangeDetected&since=0" | jq .

# В другом: создаём файл
echo "trigger event" > ~/st-lab/node1/sync/event-test.txt`
      },
      {
        title: 'Go event monitor',
        text: 'Пишем монитор с long-polling, который постоянно слушает события.',
        code: `package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type Event struct {
    ID   int       \`json:"id"\`
    Type string    \`json:"type"\`
    Time time.Time \`json:"time"\`
    Data any       \`json:"data"\`
}

func main() {
    since := 0
    for {
        url := fmt.Sprintf(
            "http://127.0.0.1:8384/rest/events?since=%d", since)
        req, _ := http.NewRequest("GET", url, nil)
        req.Header.Set("X-API-Key", "YOUR_KEY")

        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            time.Sleep(time.Second)
            continue
        }
        body, _ := io.ReadAll(resp.Body)
        resp.Body.Close()

        var events []Event
        json.Unmarshal(body, &events)
        for _, e := range events {
            fmt.Printf("[%s] %s\\n", e.Type, e.Time.Format("15:04:05"))
            since = e.ID
        }
    }
}`
      }
    ],
    codeToStudy: ['lib/events/events.go'],
    takeaways: [
      'Битовые маски — компактный способ комбинировать фильтры (DeviceConnected | ItemFinished)',
      'Кольцевой буфер хранит последние N событий без утечек памяти',
      'Подписки через Subscribe(mask) — каждый подписчик получает свой канал',
      'Long-polling: клиент блокируется до появления нового события'
    ]
  },
  {
    id: 4,
    title: 'Протокол BEP',
    time: '45 мин',
    goal: 'Block Exchange Protocol — как файлы разбиваются на блоки и синхронизируются',
    steps: [
      {
        title: 'Изучение .proto определений',
        text: 'BEP описан в Protocol Buffers — это формальная спецификация протокола.',
        code: `// proto/bep/bep.proto (ключевые сообщения)
message FileInfo {
    string name = 1;
    int64 size = 3;
    repeated BlockInfo blocks = 16;
    Vector version = 9;
}

message BlockInfo {
    int64 offset = 1;
    int32 size = 2;
    bytes hash = 3;
}

message Request {
    int32 id = 1;
    string folder = 2;
    string name = 3;
    int64 offset = 4;
    int32 size = 5;
}`
      },
      {
        title: 'Трассировка протокола',
        text: 'STTRACE=protocol показывает обмен сообщениями между нодами.',
        code: `STTRACE=protocol ./syncthing \\
  --home ~/st-lab/node1/config \\
  --gui-address 127.0.0.1:8384 2>&1 | head -50`
      },
      {
        title: 'Создание файлов разных размеров',
        text: 'Наблюдаем как протокол обрабатывает маленькие и большие файлы.',
        code: `# Маленький файл — один блок
echo "small" > ~/st-lab/node1/sync/small.txt

# Средний — несколько блоков
dd if=/dev/urandom of=~/st-lab/node1/sync/medium.bin bs=1M count=2

# Большой — много блоков
dd if=/dev/urandom of=~/st-lab/node1/sync/large.bin bs=1M count=20`
      },
      {
        title: 'Изучение реализации протокола',
        text: 'Смотрим как Go-код обрабатывает BEP-сообщения.',
        code: `grep -n "func.*protocol\\|func.*handleClusterConfig\\|func.*handleIndex" \\
  lib/protocol/protocol.go | head -20`
      },
      {
        title: 'Блочная структура через API',
        text: 'API позволяет увидеть как файл разбит на блоки.',
        code: `curl -s -H "X-API-Key: $KEY" \\
  "$API/rest/db/file?folder=default&file=large.bin" | \\
  jq '{name: .name, size: .size, blocks: (.blocks | length)}'`
      }
    ],
    codeToStudy: ['proto/bep/bep.proto', 'lib/protocol/protocol.go', 'lib/protocol/vector.go'],
    takeaways: [
      'BEP — бинарный протокол поверх TLS, описан в protobuf',
      'Файлы разбиваются на блоки по 128-512 КБ, каждый с SHA256 хешем',
      'Vector clock (Lamport) отслеживает версии файлов между устройствами',
      'Request/Response — устройство запрашивает конкретный блок по offset и size'
    ]
  },
  {
    id: 5,
    title: 'Файловая система и .stignore',
    time: '30 мин',
    goal: 'Абстракция файловой системы и система игнорирования файлов',
    steps: [
      {
        title: 'Создание .stignore',
        text: 'Файл .stignore в корне папки синхронизации определяет исключения.',
        code: `cat > ~/st-lab/node1/sync/.stignore << 'EOF'
// Временные файлы
*.tmp
*.swp

// Зависимости
node_modules
vendor

// Но сохраняем этот конкретный файл
!keep-this.tmp
EOF`
      },
      {
        title: 'Тестирование правил',
        text: 'Создаём файлы и проверяем какие синхронизируются, а какие нет.',
        code: `touch ~/st-lab/node1/sync/test.tmp
touch ~/st-lab/node1/sync/keep-this.tmp
mkdir -p ~/st-lab/node1/sync/node_modules/pkg
echo "hi" > ~/st-lab/node1/sync/node_modules/pkg/index.js
echo "real" > ~/st-lab/node1/sync/real-file.txt`
      },
      {
        title: 'Проверка через API browse',
        text: 'API показывает только не-игнорированные файлы.',
        code: `curl -s -H "X-API-Key: $KEY" \\
  "$API/db/browse?folder=default" | jq .`
      },
      {
        title: 'Трассировка сканера',
        text: 'Наблюдаем как сканер обходит файловую систему.',
        code: `STTRACE=scanner ./syncthing \\
  --home ~/st-lab/node1/config \\
  --gui-address 127.0.0.1:8384 2>&1 | grep -i ignore`
      },
      {
        title: 'Запуск тестов ignore',
        text: 'Тесты пакета ignore демонстрируют все поддерживаемые паттерны.',
        code: `cd syncthing && go test ./lib/ignore/ -v -run TestIgnore 2>&1 | head -40`
      }
    ],
    codeToStudy: ['lib/fs/basicfs.go', 'lib/ignore/ignore.go', 'lib/scanner/walk.go'],
    takeaways: [
      'lib/fs/ — абстракция файловой системы (BasicFilesystem, FakeFS для тестов)',
      '.stignore поддерживает glob, regex, отрицание (!), директории',
      'Сканер обходит дерево и фильтрует через ignore.Matcher',
      'Абстракция ФС позволяет тестировать без реального диска'
    ]
  },
  {
    id: 6,
    title: 'Конфигурация и миграции',
    time: '30 мин',
    goal: 'Система конфигурации: загрузка, валидация, миграции между версиями',
    steps: [
      {
        title: 'Изучение config.xml и JSON API',
        text: 'Конфигурация хранится в XML на диске, но API работает с JSON.',
        code: `# XML на диске
cat ~/st-lab/node1/config/config.xml | head -20

# JSON через API
curl -s -H "X-API-Key: $KEY" \\
  $API/system/config | jq '{version: .version, devices: (.devices | length)}'`
      },
      {
        title: 'Изменение через PATCH',
        text: 'API позволяет менять отдельные секции конфигурации без перезапуска.',
        code: `curl -s -X PATCH -H "X-API-Key: $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"options": {"urAccepted": -1}}' \\
  $API/system/config`
      },
      {
        title: 'Изучение миграций',
        text: 'Каждая новая версия может менять формат конфига — миграции делают это автоматически.',
        code: `grep -n "func migrateToVersion\\|case " lib/config/migrations.go | head -20`
      },
      {
        title: 'Тесты конфигурации',
        text: 'Тесты проверяют загрузку, дефолты и миграции.',
        code: `go test ./lib/config/ -v -run TestMigrate 2>&1 | head -30`
      }
    ],
    codeToStudy: ['lib/config/config.go', 'lib/config/migrations.go', 'lib/config/wrapper.go'],
    takeaways: [
      'Конфигурация: XML на диске, JSON в API, Go-структуры в коде',
      'Wrapper оборачивает Config и добавляет подписку на изменения (Observer)',
      'Миграции — цепочка функций migrateToVersionN, версия инкрементируется',
      'PATCH API позволяет менять отдельные секции без перезаписи всего конфига'
    ]
  },
  {
    id: 7,
    title: 'Тестирование',
    time: '45 мин',
    goal: 'Паттерны тестирования в Go: table-driven, coverage, benchmarks, race detector',
    steps: [
      {
        title: 'Table-driven тесты',
        text: 'Основной паттерн Go — массив тест-кейсов с циклом.',
        code: `// Пример из lib/ignore/ignore_test.go
func TestIgnorePatterns(t *testing.T) {
    tests := []struct {
        pattern string
        path    string
        want    bool
    }{
        {"*.tmp", "file.tmp", true},
        {"*.tmp", "file.go", false},
        {"dir/", "dir/file", true},
    }
    for _, tt := range tests {
        t.Run(tt.pattern+"/"+tt.path, func(t *testing.T) {
            got := matchPattern(tt.pattern, tt.path)
            if got != tt.want {
                t.Errorf("match(%q, %q) = %v, want %v",
                    tt.pattern, tt.path, got, tt.want)
            }
        })
    }
}`
      },
      {
        title: 'Coverage',
        text: 'Профиль покрытия показывает какие строки кода выполнялись в тестах.',
        code: `go test ./lib/ignore/ -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -5
go tool cover -html=coverage.out -o coverage.html`
      },
      {
        title: 'Бенчмарки',
        text: 'Benchmark-функции измеряют производительность с точностью до наносекунд.',
        code: `go test ./lib/protocol/ -bench=BenchmarkBlock -benchmem -count=3`
      },
      {
        title: 'Race detector',
        text: 'Детектор гонок находит конкурентный доступ к данным без синхронизации.',
        code: `go test ./lib/model/ -race -short -count=1 2>&1 | tail -20`
      },
      {
        title: 'Моки (counterfeiter)',
        text: 'Syncthing использует counterfeiter для генерации моков из интерфейсов.',
        code: `# Генерация мока
go generate ./lib/model/
# Использование в тестах — фейковые реализации интерфейсов`
      },
      {
        title: 'Написание своего теста',
        text: 'Пишем тест для функции расчёта размера блока.',
        code: `package protocol

import "testing"

func TestBlockSize(t *testing.T) {
    tests := []struct {
        fileSize  int64
        wantBlock int
    }{
        {0, MinBlockSize},
        {1 << 20, MinBlockSize},         // 1 MB
        {500 << 20, 256 << 10},          // 500 MB
        {8 << 30, MaxBlockSize},         // 8 GB
    }
    for _, tt := range tests {
        got := BlockSize(tt.fileSize)
        if got != tt.wantBlock {
            t.Errorf("BlockSize(%d) = %d, want %d",
                tt.fileSize, got, tt.wantBlock)
        }
    }
}`
      }
    ],
    codeToStudy: ['lib/ignore/ignore_test.go', 'lib/config/config_test.go', 'lib/model/model_test.go'],
    takeaways: [
      'Table-driven тесты — стандартный паттерн Go, читаемый и расширяемый',
      'Coverage: go test -coverprofile + go tool cover для визуализации',
      'Бенчмарки: func BenchmarkXxx(b *testing.B) { for i := 0; i < b.N; i++ { ... } }',
      '-race находит data races в рантайме — обязательно в CI'
    ]
  },
  {
    id: 8,
    title: 'Конкурентность',
    time: '50 мин',
    goal: 'Паттерны конкурентности Go: горутины, каналы, мьютексы, семафоры',
    steps: [
      {
        title: 'Наблюдение горутин через pprof',
        text: 'pprof показывает все активные горутины и их стеки.',
        code: `# Список горутин
curl -s http://127.0.0.1:8384/rest/debug/pprof/goroutine?debug=1 | head -50

# Интерактивный профиль
go tool pprof http://127.0.0.1:8384/rest/debug/pprof/goroutine`
      },
      {
        title: 'Concurrent scanner (producer-consumer)',
        text: 'Пишем сканер директорий с разделением на producer (обход) и consumer (обработка).',
        code: `package main

import (
    "crypto/sha256"
    "fmt"
    "io"
    "os"
    "path/filepath"
    "sync"
)

func main() {
    paths := make(chan string, 100)
    var wg sync.WaitGroup

    // Producer: обходит директорию
    go func() {
        filepath.Walk(os.Args[1], func(path string, info os.FileInfo, err error) error {
            if err == nil && !info.IsDir() {
                paths <- path
            }
            return nil
        })
        close(paths)
    }()

    // Consumer: 4 воркера считают хеши
    for i := 0; i < 4; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for path := range paths {
                f, err := os.Open(path)
                if err != nil {
                    continue
                }
                h := sha256.New()
                io.Copy(h, f)
                f.Close()
                fmt.Printf("[worker-%d] %x  %s\\n", id, h.Sum(nil)[:8], path)
            }
        }(i)
    }
    wg.Wait()
}`
      },
      {
        title: 'RWMutex в model',
        text: 'Model использует RWMutex для разделения read/write доступа к состоянию.',
        code: `// lib/model/model.go — паттерн
type model struct {
    fmut sync.RWMutex // protects folderRunners and friends
    pmut sync.RWMutex // protects connections
}

// Чтение — много горутин одновременно
func (m *model) Connections() map[string]ConnectionInfo {
    m.pmut.RLock()
    defer m.pmut.RUnlock()
    // ...
}

// Запись — эксклюзивный доступ
func (m *model) addConnection(c protocol.Connection) {
    m.pmut.Lock()
    defer m.pmut.Unlock()
    // ...
}`
      },
      {
        title: 'Семафоры',
        text: 'Syncthing использует каналы как семафоры для ограничения параллелизма.',
        code: `// lib/semaphore/ — семафор на канале
type Semaphore struct {
    ch chan struct{}
}

func New(size int) *Semaphore {
    return &Semaphore{ch: make(chan struct{}, size)}
}

func (s *Semaphore) Acquire() { s.ch <- struct{}{} }
func (s *Semaphore) Release() { <-s.ch }`
      }
    ],
    codeToStudy: ['lib/model/model.go', 'lib/semaphore/', 'lib/scanner/walk.go'],
    takeaways: [
      'Producer-consumer: канал + WaitGroup — базовый паттерн конкурентности',
      'RWMutex: много читателей ИЛИ один писатель — ключевой для shared state',
      'Семафор на канале: make(chan struct{}, N) — ограничивает параллелизм',
      'pprof/goroutine — основной инструмент диагностики горутин в продакшене'
    ]
  },
  {
    id: 9,
    title: 'Supervisor Tree',
    time: '30 мин',
    goal: 'Библиотека suture: жизненный цикл сервисов и автоматический перезапуск',
    steps: [
      {
        title: 'Изучение дерева сервисов',
        text: 'Syncthing организует сервисы в дерево — если child падает, supervisor перезапускает его.',
        code: `// lib/syncthing/syncthing.go — корневой supervisor
func (a *App) startup() {
    mainSvc := suture.New("main", suture.Spec{
        PassThroughPanics: true,
    })
    mainSvc.Add(a.ll)         // event logger
    mainSvc.Add(a.cfg)        // config service
    mainSvc.Add(a.evLogger)   // event logger
    mainSvc.Add(m)            // model (синхронизация)
    mainSvc.Add(apiSvc)       // REST API
    mainSvc.Serve(ctx)
}`
      },
      {
        title: 'Написание демо с suture',
        text: 'Создаём два сервиса: воркер и health checker, управляемые supervisor.',
        code: `package main

import (
    "context"
    "fmt"
    "time"

    "github.com/thejerf/suture/v4"
)

type WorkerService struct{ name string }

func (w *WorkerService) Serve(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(2 * time.Second):
            fmt.Printf("[%s] working...\\n", w.name)
        }
    }
}

type HealthChecker struct{}

func (h *HealthChecker) Serve(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(5 * time.Second):
            fmt.Println("[health] all services OK")
        }
    }
}

func main() {
    supervisor := suture.New("root", suture.Spec{})
    supervisor.Add(&WorkerService{name: "sync"})
    supervisor.Add(&WorkerService{name: "scan"})
    supervisor.Add(&HealthChecker{})

    ctx, cancel := context.WithTimeout(
        context.Background(), 20*time.Second)
    defer cancel()

    supervisor.Serve(ctx)
}`
      }
    ],
    codeToStudy: ['lib/syncthing/syncthing.go', 'lib/model/model.go'],
    takeaways: [
      'suture.Supervisor — дерево сервисов с автоматическим перезапуском (Erlang OTP стиль)',
      'Каждый сервис реализует Serve(ctx) error — единый интерфейс жизненного цикла',
      'Context для graceful shutdown — отмена распространяется по всему дереву',
      'Supervisor spec задаёт параметры: backoff, количество рестартов, таймауты'
    ]
  },
  {
    id: 10,
    title: 'Система обнаружения (Discovery)',
    time: '30 мин',
    goal: 'Как устройства находят друг друга в локальной сети и через интернет',
    steps: [
      {
        title: 'Трассировка discover',
        text: 'STTRACE=discover показывает процесс поиска устройств.',
        code: `STTRACE=discover ./syncthing \\
  --home ~/st-lab/node1/config \\
  --gui-address 127.0.0.1:8384 2>&1 | head -30`
      },
      {
        title: 'Перехват UDP broadcast',
        text: 'Local discovery использует UDP broadcast на порт 21027.',
        code: `sudo tcpdump -i lo udp port 21027 -X 2>&1 | head -30`
      },
      {
        title: 'API discovery',
        text: 'API показывает обнаруженные устройства и их адреса.',
        code: `curl -s -H "X-API-Key: $KEY" \\
  $API/system/discovery | jq .`
      },
      {
        title: 'Утилита stdisco',
        text: 'Отдельная утилита для диагностики discovery.',
        code: `go run ./cmd/stdisco/ -server https://discovery.syncthing.net \\
  -device YOUR_DEVICE_ID`
      }
    ],
    codeToStudy: ['lib/discover/local.go', 'lib/discover/global.go', 'lib/beacon/beacon.go'],
    takeaways: [
      'Local discovery: UDP broadcast на порт 21027, находит устройства в LAN за секунды',
      'Global discovery: HTTPS-сервер (discovery.syncthing.net), регистрация + lookup',
      'Beacon: периодическая отправка announce-пакетов с Device ID',
      'Несколько источников discovery объединяются — устройство найдётся любым способом'
    ]
  },
  {
    id: 11,
    title: 'TLS и безопасность',
    time: '25 мин',
    goal: 'TLS для аутентификации и шифрования: Device ID = SHA256 сертификата',
    steps: [
      {
        title: 'Просмотр сертификата',
        text: 'Каждый инстанс генерирует самоподписанный TLS-сертификат при первом запуске.',
        code: `openssl x509 -in ~/st-lab/node1/config/cert.pem \\
  -noout -text | head -20`
      },
      {
        title: 'Device ID из сертификата',
        text: 'Device ID — это SHA256 от DER-кодированного сертификата в base32.',
        code: `openssl x509 -in ~/st-lab/node1/config/cert.pem \\
  -outform DER | sha256sum`
      },
      {
        title: 'TLS handshake',
        text: 'Подключаемся к Syncthing и смотрим параметры TLS.',
        code: `openssl s_client -connect 127.0.0.1:22000 \\
  -cert ~/st-lab/node2/config/cert.pem \\
  -key ~/st-lab/node2/config/key.pem 2>&1 | head -20`
      },
      {
        title: 'Генерация ключей в коде',
        text: 'Изучаем как Syncthing генерирует TLS-сертификаты программно.',
        code: `grep -n "func Generate\\|func NewCertificate" lib/tlsutil/tlsutil.go`
      }
    ],
    codeToStudy: ['lib/tlsutil/tlsutil.go', 'lib/protocol/deviceid.go'],
    takeaways: [
      'Device ID = SHA256(DER certificate) в Luhn base32 — уникальный идентификатор',
      'Mutual TLS: обе стороны предъявляют сертификаты при подключении',
      'Нет CA — доверие строится на явном добавлении Device ID',
      'Весь трафик BEP зашифрован TLS 1.3'
    ]
  },
  {
    id: 12,
    title: 'Protocol Buffers и кодогенерация',
    time: '30 мин',
    goal: 'Protobuf: определение протокола в .proto, генерация Go-кода',
    steps: [
      {
        title: 'Изучение .proto файлов',
        text: 'BEP-протокол формально описан в protobuf — это источник истины.',
        code: `// proto/bep/bep.proto
syntax = "proto3";
package bep;

message Header {
    MessageType type = 1;
    MessageCompression compression = 2;
}

message ClusterConfig {
    repeated Folder folders = 1;
}

message Index {
    string folder = 1;
    repeated FileInfo files = 2;
}`
      },
      {
        title: 'Конфигурация buf',
        text: 'buf.yaml управляет линтингом и генерацией кода из proto-файлов.',
        code: `cat buf.yaml
cat buf.gen.yaml`
      },
      {
        title: 'Сгенерированный код',
        text: 'Protobuf компилятор создаёт Go-структуры с методами сериализации.',
        code: `ls -la internal/gen/bep/
head -50 internal/gen/bep/bep.pb.go`
      },
      {
        title: 'Перегенерация',
        text: 'Перезапускаем кодогенерацию после изменений в .proto.',
        code: `go generate ./...
# или
buf generate`
      },
      {
        title: 'Эксперимент: добавление поля',
        text: 'Добавляем новое поле в proto и наблюдаем изменения в сгенерированном коде.',
        code: `# В proto/bep/bep.proto добавляем:
# message FileInfo {
#     ...
#     string comment = 100; // наше экспериментальное поле
# }
# Затем: buf generate
# Смотрим diff в internal/gen/bep/bep.pb.go`
      }
    ],
    codeToStudy: ['proto/bep/bep.proto', 'buf.yaml', 'internal/gen/'],
    takeaways: [
      'Protobuf — язык описания данных: .proto файл → сгенерированный Go-код',
      'buf заменяет protoc: линтинг, breaking change detection, генерация',
      'Сгенерированные структуры: Marshal/Unmarshal, геттеры, Reset',
      'Новые поля с высокими номерами (100+) — безопасное расширение протокола'
    ]
  },
  {
    id: 13,
    title: 'Версионирование файлов',
    time: '25 мин',
    goal: 'Strategy pattern: разные стратегии хранения версий файлов',
    steps: [
      {
        title: 'Настройка Simple Versioning',
        text: 'Включаем версионирование через API — Syncthing будет сохранять старые версии.',
        code: `curl -s -X PATCH -H "X-API-Key: $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "folders": [{
      "id": "default",
      "versioning": {
        "type": "simple",
        "params": {"keep": "5"}
      }
    }]
  }' $API/system/config`
      },
      {
        title: 'Создание версий',
        text: 'Многократно меняем файл, чтобы создать историю версий.',
        code: `for i in 1 2 3 4 5; do
  echo "version $i" > ~/st-lab/node1/sync/versioned.txt
  sleep 2
done`
      },
      {
        title: 'Проверка .stversions',
        text: 'Старые версии сохраняются в скрытой директории .stversions.',
        code: `ls -la ~/st-lab/node1/sync/.stversions/
cat ~/st-lab/node1/sync/.stversions/versioned~*.txt`
      },
      {
        title: 'Трассировка версионирования',
        text: 'Наблюдаем работу версионера в логах.',
        code: `STTRACE=versioner ./syncthing \\
  --home ~/st-lab/node1/config \\
  --gui-address 127.0.0.1:8384 2>&1 | grep -i version`
      },
      {
        title: 'Изучение Strategy pattern',
        text: 'Каждый тип версионирования — отдельная реализация интерфейса Versioner.',
        code: `// lib/versioner/versioner.go
type Versioner interface {
    Archive(filePath string) error
    GetVersions() (map[string][]FileVersion, error)
    Restore(filePath string, versionTime time.Time) error
}

// Реализации:
// simple.go   — хранит N последних версий
// staggered.go — прореживает старые версии
// trashcan.go  — перемещает в корзину
// external.go  — вызывает внешний скрипт`
      }
    ],
    codeToStudy: ['lib/versioner/versioner.go', 'lib/versioner/simple.go', 'lib/versioner/staggered.go'],
    takeaways: [
      'Strategy pattern: интерфейс Versioner + 4 реализации (simple, staggered, trashcan, external)',
      'Simple: хранит N последних версий, самый простой',
      'Staggered: прореживает версии со временем (1 в час → 1 в день → 1 в неделю)',
      '.stversions — скрытая директория, исключена из синхронизации'
    ]
  },
  {
    id: 14,
    title: 'Build-система на Go',
    time: '20 мин',
    goal: 'Go-скрипт вместо Makefile: кросс-компиляция, встраивание версии',
    steps: [
      {
        title: 'Изучение build.go',
        text: 'build.go — полноценная система сборки, написанная на Go вместо Make.',
        code: `head -100 build.go
# Основные команды:
go run build.go build syncthing
go run build.go build all
go run build.go version`
      },
      {
        title: 'Кросс-компиляция',
        text: 'Go позволяет собирать под любую платформу одной командой.',
        code: `# Linux ARM (Raspberry Pi)
GOOS=linux GOARCH=arm go run build.go build syncthing

# macOS
GOOS=darwin GOARCH=amd64 go run build.go build syncthing

# Windows
GOOS=windows GOARCH=amd64 go run build.go build syncthing`
      },
      {
        title: 'Создание пакетов',
        text: 'build.go умеет создавать tar.gz и deb-пакеты.',
        code: `go run build.go tar
go run build.go deb`
      },
      {
        title: 'Встраивание версии через ldflags',
        text: 'Версия и дата сборки внедряются в бинарник во время компиляции.',
        code: `# Как это работает:
go build -ldflags "-X main.Version=v1.0.0 \\
  -X main.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%S)" \\
  -o syncthing ./cmd/syncthing/

# В коде:
# var Version string  // заполняется через ldflags
# var BuildDate string`
      }
    ],
    codeToStudy: ['build.go', 'lib/build/build.go'],
    takeaways: [
      'Go-скрипт сборки: go run build.go — замена Makefile, работает везде где есть Go',
      'Кросс-компиляция: GOOS/GOARCH — собирай под любую платформу без настройки',
      'ldflags -X: внедряет строковые переменные в бинарник при компиляции',
      'Один build.go для всего: сборка, тесты, пакеты, CI'
    ]
  },
  {
    id: 15,
    title: 'Интеграционные тесты',
    time: '40 мин',
    goal: 'Тестирование распределённой системы: несколько нод, сценарии синхронизации',
    steps: [
      {
        title: 'Изучение test/',
        text: 'Директория test/ содержит интеграционные тесты, запускающие несколько инстансов.',
        code: `ls test/
head -50 test/util.go`
      },
      {
        title: 'Запуск интеграционных тестов',
        text: 'build.go имеет специальную команду для интеграционных тестов.',
        code: `go run build.go integration 2>&1 | tail -30`
      },
      {
        title: 'Структура тестов',
        text: 'Каждый тест создаёт N нод, конфигурирует их и проверяет синхронизацию.',
        code: `// test/sync_test.go — типичная структура
func TestSyncBasic(t *testing.T) {
    // 1. Создаём конфиги для 2 нод
    // 2. Запускаем оба инстанса
    // 3. Создаём файлы на node1
    // 4. Ждём синхронизации (polling API)
    // 5. Проверяем файлы на node2
    // 6. Cleanup
}`
      },
      {
        title: 'Ручной мини-тест',
        text: 'Пишем простой bash-скрипт для проверки синхронизации.',
        code: `#!/bin/bash
# mini-integration-test.sh
set -e

echo "=== Starting nodes ==="
./syncthing --home /tmp/st-test-1 --gui-address :8384 &
PID1=$!
./syncthing --home /tmp/st-test-2 --gui-address :8385 &
PID2=$!
sleep 5

echo "=== Creating test file ==="
echo "integration test" > /tmp/st-test-1/sync/test.txt

echo "=== Waiting for sync ==="
for i in $(seq 1 30); do
  if [ -f /tmp/st-test-2/sync/test.txt ]; then
    echo "PASS: file synced in \${i}s"
    kill $PID1 $PID2
    exit 0
  fi
  sleep 1
done

echo "FAIL: timeout"
kill $PID1 $PID2
exit 1`
      }
    ],
    codeToStudy: ['test/util.go', 'test/sync_test.go', '.github/workflows/'],
    takeaways: [
      'Интеграционные тесты запускают реальные инстансы — полный цикл синхронизации',
      'test/util.go: хелперы для создания конфигов, ожидания синхронизации, cleanup',
      'CI запускает интеграционные тесты на каждый PR — автоматическая проверка',
      'Ручные сценарии полезны для быстрой проверки гипотез'
    ]
  }
];

const GO_TOUR_EXERCISES = [
  { id: 'tour-1', title: 'Loops and Functions', desc: 'Реализация Sqrt через цикл Ньютона', url: 'https://go.dev/tour/flowcontrol/8' },
  { id: 'tour-2', title: 'Slices', desc: 'Генерация изображения функцией Pic', url: 'https://go.dev/tour/moretypes/18' },
  { id: 'tour-3', title: 'Maps', desc: 'Подсчёт слов WordCount', url: 'https://go.dev/tour/moretypes/23' },
  { id: 'tour-4', title: 'Fibonacci closure', desc: 'Замыкание для чисел Фибоначчи', url: 'https://go.dev/tour/moretypes/26' },
  { id: 'tour-5', title: 'Stringers', desc: 'fmt.Stringer для типа IPAddr', url: 'https://go.dev/tour/methods/18' },
  { id: 'tour-6', title: 'Errors', desc: 'Sqrt с обработкой ошибок', url: 'https://go.dev/tour/methods/20' },
  { id: 'tour-7', title: 'Readers', desc: 'Reader с бесконечным потоком ASCII A', url: 'https://go.dev/tour/methods/22' },
  { id: 'tour-8', title: 'rot13Reader', desc: 'ROT13 через io.Reader обёртку', url: 'https://go.dev/tour/methods/23' },
  { id: 'tour-9', title: 'Images', desc: 'Генерация через image.Image интерфейс', url: 'https://go.dev/tour/methods/25' },
  { id: 'tour-10', title: 'Equivalent Binary Trees', desc: 'Проверка деревьев горутинами и каналами', url: 'https://go.dev/tour/concurrency/7' },
  { id: 'tour-11', title: 'Web Crawler', desc: 'Параллельный crawler с горутинами', url: 'https://go.dev/tour/concurrency/10' },
];

const GO_CODE_STUDY = [
  { id: 'code-1', title: 'cmd/syncthing/main.go', desc: 'Точка входа — как запускается приложение' },
  { id: 'code-2', title: 'lib/config/', desc: 'Система конфигурации и миграции' },
  { id: 'code-3', title: 'lib/events/', desc: 'Система событий (Observer/Pub-Sub)' },
  { id: 'code-4', title: 'lib/protocol/', desc: 'Определение и реализация BEP протокола' },
  { id: 'code-5', title: 'lib/fs/', desc: 'Абстракция файловой системы' },
  { id: 'code-6', title: 'lib/model/', desc: 'Ядро синхронизации — самый сложный пакет' },
  { id: 'code-7', title: '*_test.go', desc: 'Паттерны тестирования: table-driven, моки, бенчмарки' },
  { id: 'code-8', title: 'lib/connections/', desc: 'Мульти-транспорт: TCP, QUIC, Relay' },
  { id: 'code-9', title: 'lib/api/', desc: 'REST API: маршрутизация, middleware, auth' },
  { id: 'code-10', title: 'build.go', desc: 'Система сборки на Go вместо Make' },
];

const GO_BOOKS = [
  { id: 'book-1', title: 'The Go Programming Language', author: 'Donovan & Kernighan', stage: 'Основы' },
  { id: 'book-2', title: 'Concurrency in Go', author: 'Katherine Cox-Buday', stage: 'Конкурентность' },
  { id: 'book-3', title: '100 Go Mistakes', author: 'Teiva Harsanyi', stage: 'Качество кода' },
  { id: 'book-4', title: 'Network Programming with Go', author: 'Adam Woodbeck', stage: 'Сети' },
  { id: 'book-5', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', stage: 'Распределённые системы' },
];
