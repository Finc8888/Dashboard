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
- [ ] `www/css/widgets/<id>.css` — стили виджета
- [ ] `www/index.html` — HTML-блок с `data-widget="<id>"`
- [ ] `www/index.html` — `<script>` тег в секции Widgets
- [ ] `www/index.html` — `<link>` тег в `<head>`
- [ ] `dashboard-data-default.json` — добавить в `prod_widgets_gladys` order/visible
- [ ] `ARCHITECTURE.md` — секция 6.3 (mindmap виджетов) и 6.4 (таблица localStorage)

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
