'use strict';

// ── Widget Settings ──────────────────────────────────────────────────────
function hasPermission(perm) {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) return false;
  return Array.isArray(user.permissions) && user.permissions.includes(perm);
}

function canEditWidgets() {
  return hasPermission('widget_settings');
}

function isAdmin() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  return user && user.role === 'admin';
}

// ── Admin-only widgets ──────────────────────────────────────────────────
const ADMIN_WIDGETS_KEY = 'prod_admin_only_widgets';

function loadAdminOnlyWidgets() {
  try { return JSON.parse(localStorage.getItem(ADMIN_WIDGETS_KEY)) || []; } catch { return []; }
}

function saveAdminOnlyWidgets(list) {
  localStorage.setItem(ADMIN_WIDGETS_KEY, JSON.stringify(list));
}

function isWidgetAvailable(widgetId) {
  if (isAdmin()) return true;
  return !loadAdminOnlyWidgets().includes(widgetId);
}

// ── Widget Registry ──────────────────────────────────────────────────────
// Widgets self-register by calling registerWidget() at the bottom of their files.
// def: { id, label, zone ('top'|'grid'|'full-width'), render, init?, storageKeys? }
window.WidgetRegistry = [];

function registerWidget(def) {
  window.WidgetRegistry.push(def);
}

function getWidgetDefs() {
  return window.WidgetRegistry.map(w => ({ id: w.id, label: w.label }));
}

function getDefaultWidgetOrder() {
  return window.WidgetRegistry.map(w => w.id);
}

// Backward-compat aliases (used in settings panel, admin panel)
function _WIDGET_DEFS() { return getWidgetDefs(); }
function _DEFAULT_WIDGET_ORDER() { return getDefaultWidgetOrder(); }

function widgetSettingsKey() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const uid = user ? user.username || user.email || 'default' : 'default';
  return 'prod_widgets_' + uid;
}

function loadWidgetSettings() {
  try {
    const raw = localStorage.getItem(widgetSettingsKey());
    if (!raw) return null; // new user — no settings yet
    return JSON.parse(raw);
  } catch { return null; }
}

function saveWidgetSettings(cfg) {
  localStorage.setItem(widgetSettingsKey(), JSON.stringify(cfg));
}

function getWidgetConfig() {
  const saved = loadWidgetSettings();
  if (!saved) return null;
  // Merge: add any new widgets not in saved order
  const order = [...(saved.order || [])];
  const visible = { ...(saved.visible || {}) };
  for (const w of getDefaultWidgetOrder()) {
    if (!order.includes(w)) { order.push(w); visible[w] = false; }
  }
  return { order, visible };
}

// ── Default Data ─────────────────────────────────────────────────────────
let _defaultsPromise = null;
let _defaultsCache = null;

function loadDefaults() {
  if (!_defaultsPromise) {
    _defaultsPromise = fetch('/data/dashboard-data-default.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => { _defaultsCache = data; return data; })
      .catch(() => null);
  }
  return _defaultsPromise;
}

function getDefault(key) {
  if (!_defaultsCache) return undefined;
  return _defaultsCache[key];
}

// ── Widget Config ────────────────────────────────────────────────────────
let _widgetConfigPromise = null;
let _widgetConfigCache = null;

function loadWidgetConfig() {
  if (!_widgetConfigPromise) {
    _widgetConfigPromise = fetch('/js/widgets/widgets-config.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => { _widgetConfigCache = data; return data; })
      .catch(() => []);
  }
  return _widgetConfigPromise;
}

function applyWidgetConfig() {
  if (!_widgetConfigCache) return;
  if (!_defaultsCache) _defaultsCache = {};
  for (const cfg of _widgetConfigCache) {
    const reg = window.WidgetRegistry.find(w => w.id === cfg.id);
    if (reg) {
      reg.label = cfg.label;
      reg.zone = cfg.zone;
      reg.storageKeys = cfg.storageKeys || [];
    }
    // Merge widget defaults into global defaults cache
    if (cfg.defaults) {
      for (const [key, value] of Object.entries(cfg.defaults)) {
        if (!(key in _defaultsCache)) {
          _defaultsCache[key] = value;
        }
      }
    }
  }
}

function importWidgetDefaults() {
  if (!_widgetConfigCache) return;
  const wsKey = widgetSettingsKey();
  for (const cfg of _widgetConfigCache) {
    if (!cfg.defaults) continue;
    for (const [k, v] of Object.entries(cfg.defaults)) {
      const storageKey = /^prod_widgets_/.test(k) ? wsKey : k;
      if (localStorage.getItem(storageKey) !== null) continue;
      localStorage.setItem(storageKey, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }
}

function isNewUser() {
  return localStorage.getItem(widgetSettingsKey()) === null;
}

function importDefaults(data) {
  if (!data || typeof data !== 'object') return;
  const wsKey = widgetSettingsKey();
  Object.entries(data).forEach(([k, v]) => {
    // Remap prod_widgets_* from default/export to current user's key
    const storageKey = /^prod_widgets_/.test(k) ? wsKey : k;
    // Only set keys the user doesn't have yet (smooth merge)
    if (localStorage.getItem(storageKey) !== null) return;
    // Same conversion as importData: nested objects → JSON strings for localStorage
    localStorage.setItem(storageKey, typeof v === 'string' ? v : JSON.stringify(v));
  });
}

function rerenderAllWidgets() {
  window.WidgetRegistry.forEach(w => {
    if (typeof w.render === 'function') w.render();
  });
}

function initAllWidgets() {
  window.WidgetRegistry.forEach(w => {
    if (typeof w.init === 'function') w.init();
  });
}

function applyWidgetVisibility() {
  const cfg = getWidgetConfig();
  const emptyEl = document.getElementById('widgets-empty');
  const mainContent = document.getElementById('main-content');
  const canEdit = canEditWidgets();

  function showReady() {
    if (mainContent) mainContent.style.display = '';
    document.body.classList.add('widgets-ready');
  }

  // Check if user has dashboard permission
  if (!hasPermission('dashboard')) {
    // Hide all widgets
    document.querySelectorAll('[data-widget]').forEach(el => {
      el.style.display = 'none';
    });
    if (emptyEl) emptyEl.style.display = 'none';
    // Show blocked message
    let blockedEl = document.getElementById('dashboard-blocked');
    if (!blockedEl) {
      blockedEl = document.createElement('div');
      blockedEl.id = 'dashboard-blocked';
      blockedEl.className = 'dashboard-blocked';
      blockedEl.innerHTML = `
        <div class="dashboard-blocked-icon">🔒</div>
        <h2>Доступ к виджетам заблокирован</h2>
        <p>Администратор ограничил доступ к Dashboard.<br>Обратитесь к администратору для получения доступа.</p>
      `;
      const grid = mainContent && mainContent.querySelector('.grid');
      if (grid) mainContent.insertBefore(blockedEl, grid);
      else if (mainContent) mainContent.appendChild(blockedEl);
    }
    blockedEl.style.display = '';
    showReady();
    return;
  }

  // Remove blocked message if present
  const blockedEl = document.getElementById('dashboard-blocked');
  if (blockedEl) blockedEl.remove();

  if (!cfg) {
    // No widget config at all — hide everything (defaults should have been applied)
    document.querySelectorAll('[data-widget]').forEach(el => {
      el.style.display = 'none';
    });
    if (emptyEl) emptyEl.style.display = canEdit ? '' : 'none';
    showReady();
    return;
  }

  let anyVisible = false;
  document.querySelectorAll('[data-widget]').forEach(el => {
    const id = el.getAttribute('data-widget');
    let show = cfg.visible[id] !== false && isWidgetAvailable(id);
    if (id === 'weekend-plan') show = show && dayOff;
    if (dayOff && (id === 'todo' || id === 'productivity' || id === 'schedule')) show = false;
    el.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });

  // Reorder widgets according to cfg.order
  reorderWidgets(cfg.order);

  // Auto-span: if a grid widget is alone in its row, expand to full width
  autoSpanLoneGridWidgets();

  if (emptyEl) emptyEl.style.display = (!anyVisible && canEdit) ? '' : 'none';
  showReady();
}

function reorderWidgets(order) {
  // Top-level widgets (outside .grid): quote, personal-bar, running, wod
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const topIds = window.WidgetRegistry.filter(w => w.zone === 'top').map(w => w.id);
  const gridIds = window.WidgetRegistry.filter(w => w.zone === 'grid').map(w => w.id);
  const fullWidthIds = window.WidgetRegistry.filter(w => w.zone === 'full-width').map(w => w.id);

  // Reorder top-level widgets
  const grid = mainContent.querySelector('.grid');
  const orderedTop = order.filter(id => topIds.includes(id));
  for (const id of orderedTop) {
    const el = mainContent.querySelector(`[data-widget="${id}"]`);
    if (el && grid) mainContent.insertBefore(el, grid);
  }

  // Reorder cards inside .grid (top-level cards before full-width)
  if (grid) {
    const fullWidthDiv = grid.querySelector('.full-width');
    const orderedGrid = order.filter(id => gridIds.includes(id));
    for (const id of orderedGrid) {
      const el = grid.querySelector(`[data-widget="${id}"]`);
      if (el && fullWidthDiv) grid.insertBefore(el, fullWidthDiv);
    }

    // Reorder inside .full-width
    if (fullWidthDiv) {
      const orderedFw = order.filter(id => fullWidthIds.includes(id));
      for (const id of orderedFw) {
        const el = fullWidthDiv.querySelector(`[data-widget="${id}"]`);
        if (el) fullWidthDiv.appendChild(el);
      }
    }
  }
}

// ── Auto-span lone grid widgets ─────────────────────────────────────────
function autoSpanLoneGridWidgets() {
  const grid = document.querySelector('.grid');
  if (!grid) return;
  const gridIds = window.WidgetRegistry.filter(w => w.zone === 'grid').map(w => w.id);
  const visibleGridEls = [];
  grid.querySelectorAll('[data-widget]').forEach(el => {
    if (gridIds.includes(el.getAttribute('data-widget')) && el.style.display !== 'none') {
      visibleGridEls.push(el);
    }
  });
  // Reset all grid widgets first
  visibleGridEls.forEach(el => el.style.gridColumn = '');
  // If odd count, last visible grid widget spans full width
  if (visibleGridEls.length % 2 === 1) {
    visibleGridEls[visibleGridEls.length - 1].style.gridColumn = '1 / -1';
  }
}

// ── Widget Settings Panel ────────────────────────────────────────────────
let _wsDragItem = null;

function openWidgetSettings() {
  closeWidgetSettings();
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const canEdit = canEditWidgets();

  const overlay = document.createElement('div');
  overlay.id = 'widget-settings-overlay';
  overlay.className = 'ws-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeWidgetSettings(); };

  const userInfoHtml = user ? `<div class="ws-user-info">
    <span class="ws-user-name">${user.username}</span>
    <span class="ws-user-role">${user.role}</span>
    ${user.email ? `<span class="ws-user-email">${user.email}</span>` : ''}
  </div>` : '';

  if (!canEdit) {
    // View-only: just show user info
    overlay.innerHTML = `
      <div class="ws-panel">
        <div class="ws-header">
          <h3>Профиль</h3>
          <button class="ws-close" onclick="closeWidgetSettings()">✕</button>
        </div>
        ${userInfoHtml}
        <div class="ws-no-edit">Настройка виджетов недоступна.<br/>Обратитесь к администратору.</div>
      </div>`;
    document.body.appendChild(overlay);
    return;
  }

  const cfg = getWidgetConfig() || { order: [...getDefaultWidgetOrder()], visible: {} };
  const adminOnly = loadAdminOnlyWidgets();

  const items = cfg.order.map(id => {
    const def = getWidgetDefs().find(w => w.id === id);
    if (!def) return '';
    // Non-admin users don't see admin-only widgets in the list
    if (!isAdmin() && adminOnly.includes(id)) return '';
    const checked = cfg.visible[id] !== false && cfg.visible[id] !== undefined ? 'checked' : '';
    return `<div class="ws-item" draggable="true" data-ws-id="${id}">
      <span class="ws-drag-handle" title="Перетащить">⠿</span>
      <label class="ws-checkbox-label">
        <input type="checkbox" class="ws-checkbox" data-ws-check="${id}" ${checked} onchange="onWidgetCheckChange()" />
        <span class="ws-item-label">${def.label}</span>
      </label>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="ws-panel">
      <div class="ws-header">
        <h3>Настройки виджетов</h3>
        <button class="ws-close" onclick="closeWidgetSettings()">✕</button>
      </div>
      ${userInfoHtml}
      <div class="ws-actions">
        <button class="ws-action-btn" onclick="wsSelectAll(true)">Выбрать все</button>
        <button class="ws-action-btn" onclick="wsSelectAll(false)">Убрать все</button>
      </div>
      <div class="ws-list" id="ws-list">${items}</div>
      <div class="ws-footer">
        <button class="ws-save-btn" onclick="saveWidgetSettingsFromPanel()">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  initWsDragAndDrop();
}

function closeWidgetSettings() {
  const el = document.getElementById('widget-settings-overlay');
  if (el) el.remove();
}

function wsSelectAll(checked) {
  document.querySelectorAll('.ws-checkbox').forEach(cb => { cb.checked = checked; });
}

// ── Dashboard Admin Panel ───────────────────────────────────────────────
function openDashboardAdmin() {
  closeDashboardAdmin();
  if (!isAdmin()) return;

  const overlay = document.createElement('div');
  overlay.id = 'dashboard-admin-overlay';
  overlay.className = 'ws-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeDashboardAdmin(); };

  const adminOnly = loadAdminOnlyWidgets();

  const items = getWidgetDefs().map(w => {
    const checked = adminOnly.includes(w.id) ? 'checked' : '';
    return `<label class="ws-admin-item">
      <input type="checkbox" class="ws-admin-checkbox" data-ws-admin="${w.id}" ${checked} />
      <span>${w.label}</span>
    </label>`;
  }).join('');

  overlay.innerHTML = `
    <div class="ws-panel">
      <div class="ws-header">
        <h3>Админ-панель Dashboard</h3>
        <button class="ws-close" onclick="closeDashboardAdmin()">✕</button>
      </div>
      <div class="ws-admin-section">
        <h4 class="ws-admin-title">Виджеты только для админа</h4>
        <p class="ws-admin-desc">Отмеченные виджеты будут скрыты от обычных пользователей</p>
        <div class="ws-admin-list">${items}</div>
      </div>
      <div class="ws-footer">
        <button class="ws-save-btn" onclick="saveDashboardAdmin()">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function closeDashboardAdmin() {
  const el = document.getElementById('dashboard-admin-overlay');
  if (el) el.remove();
}

function saveDashboardAdmin() {
  const adminOnly = [];
  document.querySelectorAll('#dashboard-admin-overlay .ws-admin-checkbox').forEach(cb => {
    if (cb.checked) adminOnly.push(cb.getAttribute('data-ws-admin'));
  });
  saveAdminOnlyWidgets(adminOnly);
  closeDashboardAdmin();
  applyWidgetVisibility();
}

function onWidgetCheckChange() { /* live preview could go here */ }

function saveWidgetSettingsFromPanel() {
  const list = document.getElementById('ws-list');
  if (!list) return;
  const order = [];
  const visible = {};
  list.querySelectorAll('.ws-item').forEach(item => {
    const id = item.getAttribute('data-ws-id');
    const cb = item.querySelector('.ws-checkbox');
    order.push(id);
    visible[id] = cb ? cb.checked : false;
  });
  // Preserve order/visible for admin-only widgets not shown in list (non-admin)
  const cfg = getWidgetConfig();
  if (cfg) {
    for (const id of cfg.order) {
      if (!order.includes(id)) { order.push(id); visible[id] = cfg.visible[id] || false; }
    }
  }
  saveWidgetSettings({ order, visible });
  closeWidgetSettings();
  applyWidgetVisibility();
}

// Drag-and-drop for reordering
function initWsDragAndDrop() {
  const list = document.getElementById('ws-list');
  if (!list) return;

  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.ws-item');
    if (!item) return;
    _wsDragItem = item;
    item.classList.add('ws-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', (e) => {
    const item = e.target.closest('.ws-item');
    if (item) item.classList.remove('ws-dragging');
    _wsDragItem = null;
    list.querySelectorAll('.ws-item').forEach(el => el.classList.remove('ws-drag-over'));
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.ws-item');
    if (!target || target === _wsDragItem) return;
    list.querySelectorAll('.ws-item').forEach(el => el.classList.remove('ws-drag-over'));
    target.classList.add('ws-drag-over');
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.ws-item');
    if (!target || !_wsDragItem || target === _wsDragItem) return;
    const items = [...list.querySelectorAll('.ws-item')];
    const fromIdx = items.indexOf(_wsDragItem);
    const toIdx = items.indexOf(target);
    if (fromIdx < toIdx) {
      target.after(_wsDragItem);
    } else {
      target.before(_wsDragItem);
    }
    list.querySelectorAll('.ws-item').forEach(el => el.classList.remove('ws-drag-over'));
  });
}
