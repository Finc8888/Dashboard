# Руководство: Создание нового виджета в Dashboard UI

Модульная архитектура: один виджет = один JS-файл + один CSS-файл. Виджеты самостоятельно регистрируются через `registerWidget()`.

---

## Быстрый старт

1. Добавить запись в `www/js/widgets/widgets-config.json` (label, zone, storageKeys, defaults)
2. Создать `www/js/widgets/my-widget.js` (по шаблону ниже)
3. Создать `www/css/widgets/my-widget.css`
4. Добавить HTML-блок с `data-widget="my-widget"` в `www/index.html`
5. Добавить `<script>` и `<link>` теги в `www/index.html`

Готово. Никаких правок в `app.js`, `widget-manager.js` или других файлах не нужно.

---

## Структура файлов

```
www/js/
  core/
    utils.js              — uid(), escHtml(), todayStr(), fmtDate(), showToast()
    widget-manager.js     — WidgetRegistry, registerWidget(), visibility, reorder
                            loadWidgetConfig(), applyWidgetConfig(), importWidgetDefaults()
    keyboard.js           — горячие клавиши
    export-import.js      — exportData(), importData()
    briefing.js           — утренний брифинг + ретроспектива
    zen-mode.js           — zen mode, day-off
    clock-notif.js        — часы + уведомления
    projects.js           — навигация по проектам
  widgets/
    widgets-config.json   — единый конфиг всех виджетов (label, zone, storageKeys, defaults)
    <widget-id>.js        — каждый виджет в отдельном файле
  data/
    go-data.js            — данные Go-уроков
    training-data.js      — план тренировок
  auth.js                 — аутентификация
  word-of-day.js          — слово дня (legacy, своя инициализация)
  app.js                  — тонкий оркестратор (~20 строк)

www/css/
  core.css                — переменные, анимации, grid, header, footer, responsive
  panels.css              — модальные окна, настройки виджетов, admin
  widgets/
    <widget-id>.css       — стили каждого виджета
```

---

## Шаг 1: Конфигурация в `widgets-config.json`

Добавить запись в массив `www/js/widgets/widgets-config.json`:

```json
{
  "id": "my-widget",
  "label": "Мой виджет",
  "zone": "full-width",
  "storageKeys": ["prod_my_widget_v1"],
  "defaults": {
    "prod_my_widget_v1": []
  }
}
```

### Поля конфигурации

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `id` | string | да | Уникальный ID (kebab-case), совпадает с `data-widget` в HTML |
| `label` | string | да | Название в настройках виджетов |
| `zone` | string | да | Зона размещения: `'top'`, `'grid'`, `'full-width'` |
| `storageKeys` | string[] | да | Ключи localStorage виджета |
| `defaults` | object | да | Дефолтные значения для localStorage ключей (пустой `{}` если нет) |

Порядок записей в массиве определяет дефолтный порядок виджетов в Dashboard.

---

## Шаг 2: JS-файл виджета `www/js/widgets/my-widget.js`

```js
'use strict';

// ── My Widget ───────────────────────────────────────────────────────────
const MY_WIDGET_KEY = 'prod_my_widget_v1';

function loadMyWidget() {
  try { return JSON.parse(localStorage.getItem(MY_WIDGET_KEY) || '[]'); } catch { return []; }
}

function saveMyWidget(data) {
  localStorage.setItem(MY_WIDGET_KEY, JSON.stringify(data));
}

// ── CRUD ────────────────────────────────────────────────────────────────
function addMyItem(text) {
  const items = loadMyWidget();
  items.push({ id: uid(), text: text.trim() });
  saveMyWidget(items);
  renderMyWidget();
}

function deleteMyItem(id) {
  saveMyWidget(loadMyWidget().filter(i => i.id !== id));
  renderMyWidget();
}

// ── Render ──────────────────────────────────────────────────────────────
function renderMyWidget() {
  const el = document.getElementById('my-widget-content');
  if (!el) return;  // обязательная проверка — виджет может быть скрыт
  const items = loadMyWidget();
  el.innerHTML = items.map(i =>
    `<div>${escHtml(i.text)} <button onclick="deleteMyItem('${i.id}')">×</button></div>`
  ).join('');
}

// ── Init (опционально) ─────────────────────────────────────────────────
function initMyWidget() {
  // Event listeners, setInterval и т.д.
  // Вызывается один раз после авторизации
}

// ── Registration ────────────────────────────────────────────────────────
// label, zone, storageKeys берутся из widgets-config.json
registerWidget({
  id: 'my-widget',
  render: renderMyWidget,     // вызывается при каждом rerenderAllWidgets()
  init: initMyWidget,         // вызывается один раз (опционально)
});
```

### API `registerWidget(def)`

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `id` | string | да | Уникальный ID — должен совпадать с `id` в `widgets-config.json` |
| `render` | function | нет | Функция рендеринга, вызывается при `rerenderAllWidgets()` |
| `init` | function | нет | Функция инициализации, вызывается один раз после авторизации |

> **Примечание:** `label`, `zone`, `storageKeys` и `defaults` задаются в `widgets-config.json`, а не в `registerWidget()`. Это обеспечивает единое место настройки всех виджетов.

---

## HTML-разметка в `index.html`

### Три зоны размещения

| Зона | Где в HTML | Пример виджетов |
|------|-----------|-----------------|
| **top** | До `<div class="grid">` | quote, personal-bar, running, wod |
| **grid** | Внутри `.grid`, до `.full-width` | schedule, todo, stickers, principles |
| **full-width** | Внутри `.full-width` | go-roadmap, stats, reading, scratchpad |

```html
<!-- Мой виджет (js/widgets/my-widget.js) -->
<div class="card" data-widget="my-widget">
  <div class="card-title-row">
    <span class="card-title">Мой виджет</span>
  </div>
  <div id="my-widget-content"></div>
</div>
```

Атрибут `data-widget="my-widget"` обязателен — по нему работают visibility и reorder.

---

## CSS: `www/css/widgets/my-widget.css`

```css
/* ── My Widget ─────────────────────────────────────────────────────────── */
.my-widget-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent, #c9a96e);
}
```

---

## Паттерн: внешняя граница для мульти-карточных виджетов

Если виджет состоит из **нескольких карточек** (grid или flex), используй паттерн «контейнер + внутренние карточки». Примеры: `running`, `wod`, `personal-bar`, `stats`.

### Два варианта компоновки

| Тип | Когда использовать | Внешнее состояние |
|-----|-------------------|-------------------|
| **`.card`** | Виджет с единым контентом (список, текст, график) | `background + border + border-radius + padding: 20px + flex-column` |
| **`.widget-container`** | Виджет из нескольких независимых карточек | `background + border + border-radius` — padding и layout задаёт сам виджет |

### Как применить `.widget-container`

**HTML** — добавить класс к корневому элементу виджета:
```html
<div class="my-widget widget-container" data-widget="my-widget">
  <div class="widget-container-header">
    <span class="card-title">📌 Мой виджет</span>
  </div>
  <div class="my-inner-card">...</div>
  <div class="my-inner-card">...</div>
</div>
```

**CSS виджета** — только уникальные свойства (фон/бордер/радиус уже в `.widget-container`):
```css
.my-widget {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
  /* width/margin — если виджет вне .grid: */
  width: calc(100% - 64px);
  max-width: 1236px;
  margin: 20px auto;
}
```

**Внутренние карточки** — сохраняют собственный бордер для визуального разделения:
```css
.my-inner-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
}
```

### `.widget-container-header`

Служебный класс для заголовка внутри grid-контейнера — растягивает заголовок на все колонки:
```css
.widget-container-header { grid-column: 1 / -1; }
```

### Виджеты вне `.grid` (зона `top`)

Виджеты в зоне `top` (до основного грида) должны выравниваться по ширине грида:
```css
.my-widget {
  width: calc(100% - 64px);  /* 32px поля с каждой стороны */
  max-width: 1236px;          /* 1300px - 2×32px padding грида */
  margin: 20px auto;
  overflow: hidden;           /* если есть вложенные absolute элементы */
}
```

Брейкпоинты адаптивности совпадают с гридом: `calc(100% - 32px)` на `≤900px`, `calc(100% - 20px)` на `≤480px`.

---

## Подключение в `index.html`

### CSS (в `<head>`)
```html
<link rel="stylesheet" href="css/widgets/my-widget.css">
```

### JS (в блоке `<!-- Widgets -->`)
```html
<script src="js/widgets/my-widget.js"></script>
```

Порядок script-тегов:
1. `core/utils.js` → `core/widget-manager.js` (всегда первые)
2. `data/*.js` (данные)
3. **`widgets/*.js`** ← сюда добавить новый виджет
4. `core/keyboard.js`, `core/briefing.js` и т.д. (зависят от функций виджетов)
5. `app.js` → `auth.js` → `word-of-day.js` → `initAuth()`

---

## Дефолтные данные

Дефолтные значения виджета задаются в `widgets-config.json` в поле `defaults`:

```json
{
  "id": "my-widget",
  "label": "Мой виджет",
  "zone": "full-width",
  "storageKeys": ["prod_my_widget_v1"],
  "defaults": {
    "prod_my_widget_v1": [{ "id": "item-1", "text": "Пример" }]
  }
}
```

> **Глобальные** дефолты (не привязанные к виджету) остаются в `www/data/dashboard-data-default.json`.

Также добавить в `prod_widgets_gladys.order` и `prod_widgets_gladys.visible` (в `dashboard-data-default.json`):
```json
"order": [..., "my-widget"],
"visible": { ..., "my-widget": false }
```

---

## Соглашения

- Ключ localStorage: `prod_<name>_v<version>` (префикс `prod_` обязателен для export/import)
- Всегда `if (!el) return;` в начале render-функции
- Используй `escHtml()` для пользовательских строк в HTML
- Функции остаются глобальными (для `onclick="..."` в HTML)
- Версия в ключе (`_v1`) — менять при изменении структуры данных

---

## Итоговый чеклист

- [ ] `www/js/widgets/widgets-config.json` — запись с id, label, zone, storageKeys, defaults
- [ ] `www/js/widgets/<id>.js` — создан с `registerWidget({id, render, init})` в конце
- [ ] `www/css/widgets/<id>.css` — стили виджета (только уникальные свойства; фон/бордер/радиус — через `.card` или `.widget-container`)
- [ ] `www/index.html` — HTML-блок с `data-widget="<id>"` и классом `.card` или `.widget-container`
- [ ] `www/index.html` — `<script>` тег в секции Widgets
- [ ] `www/index.html` — `<link>` тег в `<head>`
- [ ] `dashboard-data-default.json` — добавить в `prod_widgets_gladys` order/visible
- [ ] `tests/src/widgets/<id>.test.js` — unit-тесты (load/save, CRUD, render, registration)
- [ ] `tests/src/widgets/render-after-save.test.js` — тесты render-after-save для всех мутаций
- [ ] `ARCHITECTURE.md` — секция 6.3 (mindmap виджетов) и 6.4 (таблица localStorage)

---

## Тесты для виджета

Каждый новый виджет **обязательно** должен иметь Jest-тесты. Тесты находятся в `tests/src/widgets/`.

### Обязательные тест-файлы

1. **`tests/src/widgets/<id>.test.js`** — unit-тесты CRUD-логики виджета
2. Добавить секцию в **`tests/src/widgets/render-after-save.test.js`** — тесты паттерна render-after-save

### Что тестировать в `<id>.test.js`

```js
const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
  loadWidget('<id>.js');
  applyWidgetConfigSync();
});

describe('<Widget> — load / save', () => {
  test('load returns empty array/object when no data', () => { ... });
  test('save / load roundtrip', () => { ... });
});

describe('<Widget> — add()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<DOM виджета>';
  });
  test('adds item with correct structure', () => { ... });
});

// Аналогично для update, delete, toggle и прочих мутаций
```

**Минимальный набор тестов:**

| Категория | Что проверять |
|-----------|--------------|
| **Load/Save** | `load` возвращает `[]` без данных; roundtrip save→load |
| **Create** | Добавление элемента с корректной структурой |
| **Read** | Рендер пустого состояния; рендер с данными |
| **Update** | Изменение полей сохраняется корректно |
| **Delete** | Удаление по ID; оставшиеся элементы на месте |
| **Registration** | Виджет зарегистрирован с правильным `id` и `zone` |

### Что тестировать в `render-after-save.test.js`

Каждая функция-мутация виджета должна вызывать render после сохранения. Тест шпионит за render-функцией и проверяет вызов:

```js
const widgetDom = `<DOM виджета с нужными элементами>`;

describe('<Widget> — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = widgetDom;
    spy = jest.spyOn(window, 'renderMyWidget');
  });
  afterEach(() => spy.mockRestore());

  test('addMyItem saves and renders', () => {
    addMyItem('test');
    expect(loadMyWidget()).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });

  test('deleteMyItem removes and renders', () => {
    saveMyWidget([{ id: 'x1', text: 'test' }]);
    spy.mockClear();
    deleteMyItem('x1');
    expect(loadMyWidget()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });
});
```

**Правило:** для **каждой** функции, которая вызывает `save*()`, должен быть тест проверяющий что render-функция вызвана. Это предотвращает баг "изменения видны только после перезагрузки страницы".

### DOM в тестах

Render-функции обращаются к DOM-элементам. В `beforeEach` необходимо создавать минимальный DOM с **всеми** элементами, к которым обращается render:

- Счётчики (`#<id>-done-count`, `#<id>-total-count`)
- Контейнеры списков (`#<id>-list`, `#<id>-content`)
- Индикаторы прогресса, кнопки, формы

Если DOM неполный — render упадёт с `TypeError: Cannot set properties of null`.

### Запуск тестов

```bash
make test              # все тесты через Docker
make test-fast         # без пересборки контейнера
```

### Итоговый чеклист тестов

- [ ] `tests/src/widgets/<id>.test.js` — unit-тесты load/save, CRUD, render, registration
- [ ] `tests/src/widgets/render-after-save.test.js` — секция для нового виджета (все мутации → render)
- [ ] DOM в `beforeEach` содержит все элементы, нужные render-функции
- [ ] Все тесты проходят: `make test`

---

## Добавление полноэкранного режима (fullscreen) к виджету

Паттерн позволяет развернуть карточку на весь экран. Реализован для TODO (`t`), Доски напоминаний (`m`), Weekend Plan.

### 1. HTML — кнопка в заголовке

```html
<button class="todo-expand-btn" id="my-widget-expand-btn"
        onclick="toggleMyWidgetFullscreen()" title="Развернуть">⤢</button>
```

### 2. CSS

```css
.my-card.my-widget-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9000;
  border-radius: 0;
  border: none;
  overflow-y: auto;
  padding: 32px 48px;
  background: var(--bg);
}
```

### 3. JS (в файле виджета)

```js
function toggleMyWidgetFullscreen() {
  const card = document.querySelector('.my-card');
  const btn  = document.getElementById('my-widget-expand-btn');
  const isFs = card.classList.toggle('my-widget-fullscreen');
  btn.textContent = isFs ? '⤡' : '⤢';
  btn.title = isFs ? 'Свернуть' : 'Развернуть';
}
```

### 4. Горячая клавиша

В `www/js/core/keyboard.js`, блок `switch (key)`:

```js
case '<буква>':
  e.preventDefault();
  toggleMyWidgetFullscreen();
  break;
```

### 5. Escape — закрытие

В `case 'escape':` добавить проверку перед общим else:

```js
} else if (document.querySelector('.my-card.my-widget-fullscreen')) {
  toggleMyWidgetFullscreen();
```

Занятые клавиши: `n` `f` `o` `t` `m` `d` `a` `w` `?` `1`–`0` `Space`.
