'use strict';

// ── roundRect polyfill ───────────────────────────────────────────────────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    const [tl, tr, br, bl] = r;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

// ── Widget Settings ──────────────────────────────────────────────────────
function hasPermission(perm) {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) return false;
  return Array.isArray(user.permissions) && user.permissions.includes(perm);
}

function canEditWidgets() {
  return hasPermission('widget_settings');
}

const WIDGET_DEFS = [
  { id: 'quote',         label: 'Цитата из бесед Аристотеля' },
  { id: 'personal-bar',  label: 'Дни / Подушка / Ипотека' },
  { id: 'running',       label: 'Прогресс в беге' },
  { id: 'wod',           label: 'Слово дня' },
  { id: 'schedule',      label: 'Ежедневный распорядок' },
  { id: 'todo',          label: 'TODO список' },
  { id: 'principles',    label: 'Ключевые принципы' },
  { id: 'go-roadmap',    label: 'Прогресс в Go' },
  { id: 'productivity',  label: 'Статистика продуктивности' },
  { id: 'stats',         label: 'Отвлечения / Duolingo / Ранний старт' },
  { id: 'monthly-goals', label: 'Цели на месяц' },
  { id: 'yearly-goals',  label: 'Цели на год' },
  { id: 'reading',       label: 'Список чтения' },
  { id: 'scratchpad',    label: 'Быстрые заметки' },
];
const DEFAULT_WIDGET_ORDER = WIDGET_DEFS.map(w => w.id);

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
  for (const w of DEFAULT_WIDGET_ORDER) {
    if (!order.includes(w)) { order.push(w); visible[w] = false; }
  }
  return { order, visible };
}

function applyWidgetVisibility() {
  const cfg = getWidgetConfig();
  const emptyEl = document.getElementById('widgets-empty');
  const canEdit = canEditWidgets();

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
      const mainContent = document.getElementById('main-content');
      const grid = mainContent.querySelector('.grid');
      if (grid) mainContent.insertBefore(blockedEl, grid);
      else mainContent.appendChild(blockedEl);
    }
    blockedEl.style.display = '';
    return;
  }

  // Remove blocked message if present
  const blockedEl = document.getElementById('dashboard-blocked');
  if (blockedEl) blockedEl.remove();

  if (!cfg) {
    // New user — show only TODO, hide rest
    document.querySelectorAll('[data-widget]').forEach(el => {
      el.style.display = el.getAttribute('data-widget') === 'todo' ? '' : 'none';
    });
    // Show "add widgets" button only if user has permission
    if (emptyEl) emptyEl.style.display = canEdit ? '' : 'none';
    return;
  }

  let anyVisible = false;
  document.querySelectorAll('[data-widget]').forEach(el => {
    const id = el.getAttribute('data-widget');
    const show = cfg.visible[id] !== false;
    el.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });

  // Reorder widgets according to cfg.order
  reorderWidgets(cfg.order);

  if (emptyEl) emptyEl.style.display = (!anyVisible && canEdit) ? '' : 'none';
}

function reorderWidgets(order) {
  // Top-level widgets (outside .grid): quote, personal-bar, running, wod
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const topIds = ['quote', 'personal-bar', 'running', 'wod'];
  const gridIds = ['schedule', 'todo', 'principles'];
  const fullWidthIds = ['go-roadmap', 'productivity', 'stats', 'monthly-goals', 'yearly-goals', 'reading', 'scratchpad'];

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

  const cfg = getWidgetConfig() || { order: [...DEFAULT_WIDGET_ORDER], visible: {} };

  const items = cfg.order.map(id => {
    const def = WIDGET_DEFS.find(w => w.id === id);
    if (!def) return '';
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

// ── Helpers ───────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1)  return '< 1 мин';
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Projects Hub ──────────────────────────────────────────────────────────
const PROJECTS = [
  {
    id:    'auth-admin',
    label: 'Админ-панель',
    icon:  '🔐',
    url:   '/admin/',
    desc:  'Auth Gateway · Управление пользователями',
  },
  {
    id:    'gladys-blog',
    label: 'Gladys Blog',
    icon:  '✍️',
    url:   '/blog/',
    desc:  'Hugo · Nginx · Docker',
  },
  {
    id:    'job-stats',
    label: 'Job Statistics',
    icon:  '📊',
    url:   '/jobs/',
    desc:  'Go API · React · MySQL',
  },
  {
    id:    'gladys-chat',
    label: 'Gladys Chat',
    icon:  '💬',
    url:   '/chat/',
    desc:  'Go · React · E2EE · WebSocket',
  },
];

const PROJECT_STATUS = {}; // id → 'checking' | 'online' | 'offline'

const PROJECT_PERMISSIONS = {
  'auth-admin': 'admin',
  'gladys-blog': 'blog',
  'job-stats': 'jobs',
  'gladys-chat': 'chat',
};

function getVisibleProjects() {
  const user = getCurrentUser();
  if (!user) return [];
  const perms = user.permissions || [];
  return PROJECTS.filter(p => {
    const requiredPerm = PROJECT_PERMISSIONS[p.id];
    return !requiredPerm || perms.includes(requiredPerm);
  });
}

async function checkProject(project) {
  PROJECT_STATUS[project.id] = 'checking';
  renderProjectsNav();
  try {
    const r = await fetch(project.url, { credentials: 'include', signal: AbortSignal.timeout(4000) });
    PROJECT_STATUS[project.id] = r.ok || r.status === 401 ? 'online' : 'offline';
  } catch {
    PROJECT_STATUS[project.id] = 'offline';
  }
  renderProjectsNav();
}

function openProject(project) {
  if (PROJECT_STATUS[project.id] === 'offline') {
    showProjectOfflineMsg(project.id);
    return;
  }
  window.location.href = project.url;
}

function showProjectOfflineMsg(projectId) {
  const msgEl = document.getElementById('proj-msg-' + projectId);
  if (!msgEl) return;
  msgEl.style.display = '';
  clearTimeout(msgEl._hideTimer);
  msgEl._hideTimer = setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
}

function renderProjectsNav() {
  const list = document.getElementById('projects-nav-list');
  if (!list) return;
  const visible = getVisibleProjects();
  list.innerHTML = visible.map(p => {
    const status = PROJECT_STATUS[p.id] || 'checking';
    const dotCls = status === 'online' ? 'proj-dot-online'
                 : status === 'offline' ? 'proj-dot-offline'
                 : 'proj-dot-checking';
    return `
      <div class="proj-item">
        <button class="proj-btn" onclick="openProject(PROJECTS.find(p=>p.id==='${p.id}'))">
          <span class="proj-dot ${dotCls}"></span>
          <span class="proj-icon">${p.icon}</span>
          <span class="proj-label">${p.label}</span>
          <span class="proj-desc">${p.desc}</span>
        </button>
        <div class="proj-offline-msg" id="proj-msg-${p.id}" style="display:none">
          Проект недоступен — запустите Docker-контейнер
        </div>
      </div>`;
  }).join('');
}

let _projectsIntervalId = null;

function initProjectsNav() {
  renderProjectsNav();
  const visible = getVisibleProjects();
  visible.forEach(p => checkProject(p));
  if (_projectsIntervalId) clearInterval(_projectsIntervalId);
  _projectsIntervalId = setInterval(() => {
    const vis = getVisibleProjects();
    vis.forEach(p => checkProject(p));
  }, 30000);
}

// ── Days counter ──────────────────────────────────────────────────────────
const DAYS_KEY = 'prod_days_v1';

function loadDaysData() {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY)); } catch { return null; }
}
function saveDaysData(d) { localStorage.setItem(DAYS_KEY, JSON.stringify(d)); }

function renderDaysCounter() {
  let data = loadDaysData();
  if (!data) {
    const y = new Date().getFullYear();
    data = { startDate: `${y}-03-09`, failCount: 0 };
    saveDaysData(data);
  }
  const start = new Date(data.startDate + 'T00:00:00');
  const days  = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  document.getElementById('days-counter').textContent = days;
  const startFmt = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('days-since-label').textContent = `с ${startFmt}`;

  const badgesEl = document.getElementById('days-fail-badges');
  if (badgesEl) {
    if (data.failCount > 0) {
      badgesEl.innerHTML = Array(data.failCount).fill('<span class="fail-badge" title="Попытка бросить">💔</span>').join('');
      badgesEl.style.display = '';
    } else {
      badgesEl.innerHTML = '';
      badgesEl.style.display = 'none';
    }
  }
}

function resetDaysCounter() {
  if (!confirm('Сбросить счётчик? Это отметит нарушение.')) return;
  const data = loadDaysData() || { startDate: '', failCount: 0 };
  data.failCount = (data.failCount || 0) + 1;
  data.startDate = new Date().toISOString().slice(0, 10);
  saveDaysData(data);
  renderDaysCounter();
}

function editDaysDate() {
  const data = loadDaysData() || { startDate: new Date().toISOString().slice(0, 10), failCount: 0 };
  const newDate = prompt('Введите дату начала (ГГГГ-ММ-ДД):', data.startDate);
  if (!newDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { alert('Неверный формат. Используйте ГГГГ-ММ-ДД'); return; }
  const d = new Date(newDate + 'T00:00:00');
  if (isNaN(d.getTime())) { alert('Некорректная дата'); return; }
  data.startDate = newDate;
  saveDaysData(data);
  renderDaysCounter();
}

renderDaysCounter();

// ── Financial cushions ────────────────────────────────────────────────────
const CUSHION_KEY = 'prod_cushions';

function getCushions() {
  return parseInt(localStorage.getItem(CUSHION_KEY) ?? '7', 10);
}
function renderCushions() {
  document.getElementById('cushion-count').textContent = getCushions();
}
function changeCushions(delta) {
  const val = Math.max(0, getCushions() + delta);
  localStorage.setItem(CUSHION_KEY, val);
  renderCushions();
}
renderCushions();

// ── Mortgage ───────────────────────────────────────────────────────────────
const MORTGAGE_KEY = 'prod_mortgage_v1';

function loadMortgage() {
  try { return JSON.parse(localStorage.getItem(MORTGAGE_KEY) || '{}'); } catch { return {}; }
}
function saveMortgageData(d) { localStorage.setItem(MORTGAGE_KEY, JSON.stringify(d)); }

function fmtRub(n) {
  const num = parseFloat(n) || 0;
  const hasKopecks = num % 1 !== 0;
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: hasKopecks ? 2 : 0,
    maximumFractionDigits: 2,
  }) + ' ₽';
}
function fmtMortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function renderMortgage() {
  const d = loadMortgage();
  document.getElementById('mort-payment').textContent = fmtRub(d.payment || 0);
  document.getElementById('mort-debt').textContent    = fmtRub(d.debt    || 0);

  const rateEl = document.getElementById('mort-rate');
  rateEl.textContent = (d.rate || 0) + '%';

  const datesEl = document.getElementById('mort-dates');
  const start = fmtMortDate(d.startDate);
  const end   = fmtMortDate(d.endDate);
  if (d.startDate || d.endDate) {
    datesEl.textContent = start + ' → ' + end;
  } else {
    datesEl.textContent = '—';
  }

  const paydayEl = document.getElementById('mort-payday');
  paydayEl.textContent = d.payDay ? d.payDay + '-го числа' : '—';
}

function toggleMortgageEdit() {
  const panel  = document.getElementById('mortgage-edit-panel');
  const body   = document.getElementById('mortgage-display');
  const btn    = document.getElementById('mortgage-edit-btn');
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    body.style.display  = '';
    btn.classList.remove('active');
  } else {
    const d = loadMortgage();
    document.getElementById('mort-input-payment').value  = d.payment  || '';
    document.getElementById('mort-input-debt').value     = d.debt     || '';
    document.getElementById('mort-input-rate').value     = d.rate     || '';
    document.getElementById('mort-input-start').value    = d.startDate || '';
    document.getElementById('mort-input-end').value      = d.endDate   || '';
    document.getElementById('mort-input-payday').value   = d.payDay   || '';
    panel.style.display = '';
    body.style.display  = 'none';
    btn.classList.add('active');
  }
}

function closeMortgageEdit() {
  document.getElementById('mortgage-edit-panel').style.display = 'none';
  document.getElementById('mortgage-display').style.display    = '';
  document.getElementById('mortgage-edit-btn').classList.remove('active');
}

function saveMortgage() {
  const d = {
    payment:   parseFloat(document.getElementById('mort-input-payment').value) || 0,
    debt:      parseFloat(document.getElementById('mort-input-debt').value)    || 0,
    rate:      parseFloat(document.getElementById('mort-input-rate').value)  || 0,
    startDate: document.getElementById('mort-input-start').value  || '',
    endDate:   document.getElementById('mort-input-end').value    || '',
    payDay:    parseInt(document.getElementById('mort-input-payday').value,  10) || 0,
  };
  saveMortgageData(d);
  closeMortgageEdit();
  renderMortgage();
}

renderMortgage();

// ── Clock ─────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('live-clock').textContent =
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
updateClock();
setInterval(updateClock, 1000);

// ── Notifications ─────────────────────────────────────────────────────────
const NOTIF_KEY = 'prod_notif_enabled';
let notifEnabled = localStorage.getItem(NOTIF_KEY) === '1';

function updateNotifBtn() {
  const btn   = document.getElementById('notif-btn');
  const icon  = document.getElementById('notif-icon');
  const label = document.getElementById('notif-label');
  if (!('Notification' in window) || Notification.permission === 'denied') {
    btn.className = 'notif-btn denied';
    icon.textContent = '🔕';
    label.textContent = 'заблокировано';
    return;
  }
  if (notifEnabled && Notification.permission === 'granted') {
    btn.className = 'notif-btn enabled';
    icon.textContent = '🔔';
    label.textContent = 'уведомления вкл';
  } else {
    btn.className = 'notif-btn';
    icon.textContent = '🔔';
    label.textContent = 'уведомления';
  }
}

function toggleNotifications() {
  if (!('Notification' in window) || Notification.permission === 'denied') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') { notifEnabled = true; localStorage.setItem(NOTIF_KEY, '1'); }
      updateNotifBtn();
    });
    return;
  }
  notifEnabled = !notifEnabled;
  localStorage.setItem(NOTIF_KEY, notifEnabled ? '1' : '0');
  updateNotifBtn();
}

function sendNotification(title, body) {
  if (!notifEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="26" font-size="28">⏰</text></svg>',
  });
}

updateNotifBtn();

// ── Schedule ──────────────────────────────────────────────────────────────
const SCHEDULE_LABELS_KEY = 'prod_schedule_labels_v1';

const slots = [
  { time: '07:00', end: '07:30', dot: 'dot-muted'  },
  { time: '07:30', end: '09:30', dot: 'dot-red'    },
  { time: '09:30', end: '09:45', dot: 'dot-muted'  },
  { time: '09:45', end: '10:30', dot: 'dot-yellow' },
  { time: '10:30', end: '12:00', dot: 'dot-red'    },
  { time: '12:00', end: '13:00', dot: 'dot-muted'  },
  { time: '13:00', end: '15:00', dot: 'dot-red'    },
  { time: '15:00', end: '15:15', dot: 'dot-muted'  },
  { time: '15:15', end: '16:00', dot: 'dot-green'  },
  { time: '16:00', end: '18:30', dot: 'dot-blue'   },
  { time: '18:30', end: '19:00', dot: 'dot-muted'  },
  { time: '19:00', end: '20:00', dot: 'dot-cyan'   },
  { time: '20:00', end: '21:00', dot: 'dot-purple' },
  { time: '21:00', end: '21:15', dot: 'dot-muted'  },
  { time: '21:15', end: '22:30', dot: 'dot-purple' },
  { time: '22:30', end: '23:59', dot: 'dot-muted'  },
];
const READING_SLOT_INDEX = 14;

function loadScheduleLabels() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_LABELS_KEY) || 'null'); } catch { return null; }
}
function saveScheduleLabels(labels) { localStorage.setItem(SCHEDULE_LABELS_KEY, JSON.stringify(labels)); }

function getSlotLabel(index) {
  const labels = loadScheduleLabels();
  if (labels && labels[index] !== undefined) return labels[index].label;
  return `Окно расписания ${index + 1}`;
}
function getSlotSub(index) {
  const labels = loadScheduleLabels();
  if (labels && labels[index] !== undefined) return labels[index].sub || '';
  return '';
}

function startEditSlotLabel(index) {
  const el = document.getElementById('slot-label-' + index);
  if (!el) return;
  const currentLabel = getSlotLabel(index);
  const currentSub = getSlotSub(index);
  el.innerHTML = `
    <input class="slot-edit-input" id="slot-edit-label-${index}" value="${currentLabel.replace(/"/g, '&quot;')}" placeholder="Название" />
    <input class="slot-edit-input slot-edit-sub" id="slot-edit-sub-${index}" value="${currentSub.replace(/"/g, '&quot;')}" placeholder="Описание" />
    <button class="slot-edit-ok" onclick="saveSlotLabel(${index})">OK</button>
    <button class="slot-edit-cancel" onclick="renderTimeline()">✕</button>`;
  document.getElementById('slot-edit-label-' + index).focus();
  document.getElementById('slot-edit-label-' + index).addEventListener('keydown', e => { if (e.key === 'Enter') saveSlotLabel(index); if (e.key === 'Escape') renderTimeline(); });
  document.getElementById('slot-edit-sub-' + index).addEventListener('keydown', e => { if (e.key === 'Enter') saveSlotLabel(index); if (e.key === 'Escape') renderTimeline(); });
}

function saveSlotLabel(index) {
  const labelVal = document.getElementById('slot-edit-label-' + index).value.trim();
  const subVal = document.getElementById('slot-edit-sub-' + index).value.trim();
  if (!labelVal) return;
  const labels = loadScheduleLabels() || {};
  labels[index] = { label: labelVal, sub: subVal };
  saveScheduleLabels(labels);
  renderTimeline();
}

let lastActiveIndex = -1;

let _audioCtx = null;
document.addEventListener('click', () => {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  } else if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
}, { once: true });

function playTransitionChime() {
  if (!_audioCtx || _audioCtx.state !== 'running') return;
  try {
    const ctx = _audioCtx;
    const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 — мажорный аккорд
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  } catch (e) { /* Audio API недоступен */ }
}

function renderTimeline() {
  const now        = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const tl         = document.getElementById('timeline');

  let activeIndex = -1;
  slots.forEach((s, i) => {
    if (currentMin >= timeToMinutes(s.time) && currentMin < timeToMinutes(s.end)) activeIndex = i;
  });

  const isTransition = activeIndex !== -1 && activeIndex !== lastActiveIndex;
  if (isTransition) {
    const s = slots[activeIndex];
    const label = getSlotLabel(activeIndex);
    const sub = getSlotSub(activeIndex);
    sendNotification('Новый блок расписания', `${s.time} — ${label}${sub ? '\n' + sub : ''}`);
    playTransitionChime();
    if (activeIndex === READING_SLOT_INDEX) notifyTaskSummary();
    lastActiveIndex = activeIndex;
  }

  tl.innerHTML = '';
  let nowInserted = false;

  slots.forEach((slot, i) => {
    const startMin = timeToMinutes(slot.time);
    const endMin   = timeToMinutes(slot.end);
    const isPast   = currentMin >= endMin;
    const isActive = i === activeIndex;
    const isNew    = isActive && isTransition;
    const label    = getSlotLabel(i);
    const sub      = getSlotSub(i);

    if (!nowInserted && startMin > currentMin) {
      const marker = document.createElement('div');
      marker.className = 'now-marker';
      marker.innerHTML = `<span class="now-badge">▶ сейчас</span>`;
      tl.appendChild(marker);
      nowInserted = true;
    }

    const el = document.createElement('div');
    el.className = 'slot'
      + (isPast   ? ' past'     : '')
      + (isActive ? ' active'   : '')
      + (isNew    ? ' entering' : '');
    el.innerHTML = `
      <div class="slot-time">${slot.time}</div>
      <div class="slot-dot ${slot.dot}"></div>
      <div class="slot-content" id="slot-label-${i}">
        <div class="slot-label">${label} <button class="slot-rename-btn" onclick="event.stopPropagation(); startEditSlotLabel(${i})" title="Переименовать">✎</button></div>
        ${sub ? `<div class="slot-sub">${sub}</div>` : ''}
      </div>`;
    tl.appendChild(el);

    if (isActive && !nowInserted) {
      const marker = document.createElement('div');
      marker.className = 'now-marker';
      marker.innerHTML = `<span class="now-badge">▶ сейчас</span>`;
      tl.appendChild(marker);
      nowInserted = true;
    }
  });

  if (!nowInserted) {
    const marker = document.createElement('div');
    marker.className = 'now-marker';
    marker.innerHTML = `<span class="now-badge">▶ сейчас</span>`;
    tl.appendChild(marker);
  }
}

renderTimeline();
setInterval(renderTimeline, 30000);

// ── TODO List ─────────────────────────────────────────────────────────────
let dragSrcId = null;

const TASKS_KEY   = 'prod_tasks_v1';
const HISTORY_KEY = 'prod_history_v1';

function loadTasks()    { try { return JSON.parse(localStorage.getItem(TASKS_KEY)   || '[]'); } catch { return []; } }
function saveTasks(t)   { localStorage.setItem(TASKS_KEY,   JSON.stringify(t)); }
function loadHistory()  { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

function addTask(text) {
  const tasks = loadTasks();
  tasks.push({ id: uid(), text: text.trim(), addedAt: new Date().toISOString(), addedDate: todayStr(), done: false, doneAt: null, current: false });
  saveTasks(tasks);
  renderTodo();
  renderProdStats();
}

function toggleTask(id) {
  const tasks = loadTasks();
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const task = tasks[idx];
  if (!task.done) {
    task.done   = true;
    task.doneAt = new Date().toISOString();
    const history = loadHistory();
    history.unshift({
      id:       task.id,
      text:     task.text,
      addedAt:  task.addedAt,
      doneAt:   task.doneAt,
      workedMs: new Date(task.doneAt) - new Date(task.addedAt),
    });
    saveHistory(history);
    tasks.splice(idx, 1);
  } else {
    task.done   = false;
    task.doneAt = null;
    saveHistory(loadHistory().filter(h => h.id !== id));
  }
  saveTasks(tasks);
  renderTodo();
  renderProdStats();
  if (document.getElementById('history-panel').classList.contains('open')) renderHistory();
}

function deleteTask(id) {
  saveTasks(loadTasks().filter(t => t.id !== id));
  renderTodo();
  renderProdStats();
}

function setCurrentTask(id) {
  const tasks = loadTasks();
  const clickedTask = tasks.find(t => t.id === id);
  const isCurrentlyActive = clickedTask && clickedTask.current;
  tasks.forEach(t => { t.current = false; });
  if (!isCurrentlyActive) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx].current = true;
      const [task] = tasks.splice(idx, 1);
      tasks.unshift(task);
    }
  }
  saveTasks(tasks);
  renderTodo();
}

function startRenameTask(id) {
  const itemEl = document.querySelector(`.todo-item[data-task-id="${id}"]`);
  if (!itemEl) return;
  const textEl = itemEl.querySelector('.todo-text');
  if (!textEl) return;
  const task = loadTasks().find(t => t.id === id);
  if (!task) return;

  const input = document.createElement('input');
  input.className = 'todo-rename-input';
  input.value = task.text;
  textEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  function save() {
    if (saved) return;
    saved = true;
    const newText = input.value.trim();
    if (newText && newText !== task.text) {
      const tasks = loadTasks();
      const idx = tasks.findIndex(t => t.id === id);
      if (idx !== -1) { tasks[idx].text = newText; saveTasks(tasks); }
    }
    renderTodo();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { saved = true; renderTodo(); }
  });
  input.addEventListener('blur', save);
}

function renderTodo() {
  const tasks    = loadTasks();
  const today    = todayStr();
  const doneEl   = document.getElementById('todo-done-count');
  const totalEl  = document.getElementById('todo-total-count');
  const list     = document.getElementById('todo-list');

  const histToday = loadHistory().filter(h => h.doneAt && h.doneAt.slice(0, 10) === today).length;
  doneEl.textContent  = histToday;
  totalEl.textContent = tasks.length + histToday;

  list.innerHTML = '';

  if (!tasks.length) {
    list.innerHTML = `<div class="todo-empty">Все задачи выполнены 🎉</div>`;
    return;
  }

  tasks.forEach(task => {
    const isCarried = task.addedDate < today;
    const el = document.createElement('div');
    el.className = 'todo-item'
      + (task.done    ? ' done'    : '')
      + (task.current ? ' current' : '');
    el.setAttribute('draggable', 'true');
    el.dataset.taskId = task.id;

    el.innerHTML = `
      <div class="drag-handle" title="Перетащить">⠿</div>
      <div class="todo-checkbox" onclick="toggleTask('${task.id}')">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="todo-body">
        <div class="todo-text">${escHtml(task.text)}</div>
        <div class="todo-item-meta">
          <span class="todo-date">${fmtDate(task.addedAt)}</span>
          ${isCarried ? `<span class="carry-badge">перенесено с ${task.addedDate}</span>` : ''}
        </div>
      </div>
      <div class="todo-actions">
        <button class="todo-current-btn${task.current ? ' active' : ''}" onclick="setCurrentTask('${task.id}')" title="${task.current ? 'Снять отметку текущей' : 'Отметить как текущую'}">◎</button>
        <button class="todo-rename-btn" onclick="startRenameTask('${task.id}')" title="Переименовать">✎</button>
        <button class="todo-del" onclick="deleteTask('${task.id}')" title="Удалить">×</button>
      </div>`;

    // Drag events
    el.addEventListener('dragstart', e => {
      dragSrcId = task.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.todo-item.drag-over').forEach(i => i.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrcId !== task.id) {
        document.querySelectorAll('.todo-item.drag-over').forEach(i => i.classList.remove('drag-over'));
        el.classList.add('drag-over');
      }
    });
    el.addEventListener('dragleave', e => {
      if (e.target === el || el.contains(e.relatedTarget) === false) {
        el.classList.remove('drag-over');
      }
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
      if (dragSrcId === task.id) return;
      const tasks2 = loadTasks();
      const srcIdx = tasks2.findIndex(t => t.id === dragSrcId);
      const dstIdx = tasks2.findIndex(t => t.id === task.id);
      if (srcIdx === -1 || dstIdx === -1) return;
      const [moved] = tasks2.splice(srcIdx, 1);
      tasks2.splice(dstIdx, 0, moved);
      saveTasks(tasks2);
      renderTodo();
    });

    list.appendChild(el);
  });
}

document.getElementById('todo-add-btn').addEventListener('click', () => {
  const input = document.getElementById('todo-input');
  if (input.value.trim()) { addTask(input.value); input.value = ''; }
});
document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) { addTask(e.target.value); e.target.value = ''; }
});

// ── History ───────────────────────────────────────────────────────────────
function toggleHistory() {
  const panel = document.getElementById('history-panel');
  const btn   = document.getElementById('history-toggle-btn');
  const isOpen = panel.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  if (isOpen) renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  const el      = document.getElementById('history-list');
  if (!history.length) {
    el.innerHTML = `<div class="history-empty">История пуста</div>`;
    return;
  }
  el.innerHTML = '';
  history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div>
        <div class="history-item-name">${escHtml(h.text)}</div>
        <div class="history-item-dates">Добавлено: ${fmtDate(h.addedAt)} · Выполнено: ${fmtDate(h.doneAt)}</div>
      </div>
      <div class="history-duration">${fmtDuration(h.workedMs)}</div>`;
    el.appendChild(item);
  });
}

function clearHistory() {
  if (!confirm('Очистить всю историю выполненных задач?')) return;
  saveHistory([]);
  renderHistory();
}

// ── Task summary (before Lem) ─────────────────────────────────────────────
function notifyTaskSummary() {
  const undone = loadTasks().filter(t => !t.done).length;
  if (undone === 0) {
    sendNotification('📖 Время читать!', 'Все задачи дня выполнены 🎉 Заслуженный отдых!');
  } else {
    sendNotification('📖 Время читать!', `Осталось ${undone} невыполненных задач 📋 Перенесутся на завтра.`);
  }
}

renderTodo();

// ── Goals (Monthly & Yearly) ──────────────────────────────────────────
const MONTHLY_GOALS_KEY = 'prod_monthly_goals_v2';
const YEARLY_GOALS_KEY  = 'prod_yearly_goals_v2';

const MONTH_NAMES = [
  'январь','февраль','март','апрель','май','июнь',
  'июль','август','сентябрь','октябрь','ноябрь','декабрь'
];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentYearKey() {
  return String(new Date().getFullYear());
}

function loadGoalsStore(storageKey) {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
}
function saveGoalsStore(storageKey, data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function getGoalsForPeriod(storageKey, periodKey) {
  const store = loadGoalsStore(storageKey);
  return store[periodKey] || [];
}
function setGoalsForPeriod(storageKey, periodKey, goals) {
  const store = loadGoalsStore(storageKey);
  store[periodKey] = goals;
  saveGoalsStore(storageKey, store);
}

// Migrate old goals (prod_goals_v1) to monthly format once
(function migrateOldGoals() {
  const OLD_KEY = 'prod_goals_v1';
  const old = localStorage.getItem(OLD_KEY);
  if (!old) return;
  try {
    const checked = JSON.parse(old);
    const existing = getGoalsForPeriod(MONTHLY_GOALS_KEY, '2025-03');
    if (existing.length > 0) { localStorage.removeItem(OLD_KEY); return; }
    const oldGoalsData = [
      { id: 'tour',    icon: '🟦', text: 'Пройти Tour of Go полностью' },
      { id: 'scripts', icon: '📗', text: 'Написать 30 маленьких скриптов на Go (1 в день)' },
      { id: 'tasks',   icon: '🔴', text: 'Закрыть 10 накопившихся рабочих задач' },
      { id: 'duo',     icon: '📱', text: 'Не пропустить Duolingo более 2 раз' },
      { id: 'blocker', icon: '📵', text: 'Установить блокировщик YouTube/новостей в первый же день' },
      { id: 'lem',     icon: '📖', text: 'Прочитать первые две книги списка (Тед Чан)' },
      { id: 'early',   icon: '⏰', text: 'Начинать рабочий день с 7 утра каждый день', recurring: 'early-start' },
    ];
    const ids = ['tour','scripts','tasks','duo','blocker','lem','early'];
    const migrated = oldGoalsData.map((g, i) => {
      const goal = {
        id: uid(),
        text: g.text,
        icon: g.icon,
        done: !!checked[ids[i]],
        createdAt: '2025-03-09',
      };
      if (g.recurring) goal.recurring = g.recurring;
      return goal;
    });
    setGoalsForPeriod(MONTHLY_GOALS_KEY, '2025-03', migrated);
    localStorage.removeItem(OLD_KEY);
  } catch { localStorage.removeItem(OLD_KEY); }
})();

// Carry over goals from previous periods:
// - incomplete goals always carry over
// - recurring goals always carry over (reset to undone)
function carryOverGoals(storageKey, currentKey) {
  const store = loadGoalsStore(storageKey);
  if (store[currentKey] && store[currentKey].length > 0) return;
  const keys = Object.keys(store).filter(k => k < currentKey).sort();
  if (!keys.length) return;
  const prevKey = keys[keys.length - 1];
  const prevGoals = store[prevKey] || [];
  const toCarry = prevGoals.filter(g => !g.done || g.recurring);
  if (!toCarry.length) return;
  const carried = toCarry.map(g => ({
    ...g,
    id: uid(),
    done: false,
    carriedFrom: prevKey,
    createdAt: todayStr(),
  }));
  store[currentKey] = carried;
  saveGoalsStore(storageKey, store);
}

carryOverGoals(MONTHLY_GOALS_KEY, currentMonthKey());
carryOverGoals(YEARLY_GOALS_KEY, currentYearKey());

let goalEditId = null;

function addGoal(storageKey, periodKey, text) {
  const goals = getGoalsForPeriod(storageKey, periodKey);
  goals.push({ id: uid(), text: text.trim(), icon: '🎯', done: false, createdAt: todayStr() });
  setGoalsForPeriod(storageKey, periodKey, goals);
}

function toggleGoal(storageKey, periodKey, goalId) {
  const goals = getGoalsForPeriod(storageKey, periodKey);
  const g = goals.find(x => x.id === goalId);
  if (g) g.done = !g.done;
  setGoalsForPeriod(storageKey, periodKey, goals);
}

function deleteGoal(storageKey, periodKey, goalId) {
  const goals = getGoalsForPeriod(storageKey, periodKey).filter(g => g.id !== goalId);
  setGoalsForPeriod(storageKey, periodKey, goals);
}

function saveGoalEdit(storageKey, periodKey, goalId, newText) {
  const goals = getGoalsForPeriod(storageKey, periodKey);
  const g = goals.find(x => x.id === goalId);
  if (g && newText.trim()) g.text = newText.trim();
  setGoalsForPeriod(storageKey, periodKey, goals);
  goalEditId = null;
}

function startGoalEdit(id) {
  goalEditId = id;
  renderAllGoals();
}

function cancelGoalEdit() {
  goalEditId = null;
  renderAllGoals();
}

function formatMonthTitle(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function renderGoalsList(container, goals, storageKey, periodKey) {
  container.innerHTML = '';
  if (!goals.length) {
    container.innerHTML = '<div class="goals-empty">Нет целей — добавьте первую</div>';
    return;
  }
  goals.forEach(g => {
    const el = document.createElement('div');
    el.className = 'goal' + (g.done ? ' checked' : '');

    if (goalEditId === g.id) {
      el.className = 'goal goal-editing';
      el.innerHTML = `
        <input class="goal-edit-input" id="goal-edit-${g.id}" type="text" value="${escHtml(g.text)}" maxlength="200" />
        <button class="goal-save-btn" onclick="saveGoalEdit('${storageKey}','${periodKey}','${g.id}',document.getElementById('goal-edit-${g.id}').value);renderAllGoals()">✓</button>
        <button class="goal-cancel-btn" onclick="cancelGoalEdit()">✕</button>`;
      container.appendChild(el);
      setTimeout(() => {
        const inp = document.getElementById('goal-edit-' + g.id);
        if (inp) { inp.focus(); inp.select(); }
      }, 0);
      return;
    }

    el.innerHTML = `
      <div class="checkbox" onclick="toggleGoal('${storageKey}','${periodKey}','${g.id}');renderAllGoals()">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="goal-icon">${g.icon}</span>
      <span class="goal-text">${escHtml(g.text)}</span>
      ${g.carriedFrom ? `<span class="goal-carried-badge">перенесено</span>` : ''}
      <div class="goal-actions">
        <button class="goal-edit-btn" onclick="event.stopPropagation();startGoalEdit('${g.id}')" title="Редактировать">✎</button>
        <button class="goal-del-btn" onclick="event.stopPropagation();deleteGoal('${storageKey}','${periodKey}','${g.id}');renderAllGoals()" title="Удалить">×</button>
      </div>`;
    container.appendChild(el);
  });
}

function renderGoalsProgress(containerId, goals) {
  const el = document.getElementById(containerId);
  if (!goals.length) { el.innerHTML = ''; return; }
  const done = goals.filter(g => g.done).length;
  const pct = Math.round((done / goals.length) * 100);
  el.innerHTML = `
    <div class="goals-pbar">
      <div class="goals-pbar-fill" style="width:${pct}%"></div>
    </div>
    <span class="goals-pbar-text">${done} / ${goals.length} выполнено · ${pct}%</span>`;
}

function renderAllGoals() {
  const mk = currentMonthKey();
  const [my, mm] = mk.split('-');
  document.getElementById('monthly-goals-title').textContent =
    `🎯 Цели на ${MONTH_NAMES[parseInt(mm, 10) - 1]} ${my} года`;
  const monthlyGoals = getGoalsForPeriod(MONTHLY_GOALS_KEY, mk);
  renderGoalsList(document.getElementById('monthly-goals'), monthlyGoals, MONTHLY_GOALS_KEY, mk);
  renderGoalsProgress('monthly-goals-progress', monthlyGoals);

  const yk = currentYearKey();
  document.getElementById('yearly-goals-title').textContent =
    `🎯 Цели на ${yk} год`;
  const yearlyGoals = getGoalsForPeriod(YEARLY_GOALS_KEY, yk);
  renderGoalsList(document.getElementById('yearly-goals'), yearlyGoals, YEARLY_GOALS_KEY, yk);
  renderGoalsProgress('yearly-goals-progress', yearlyGoals);
}

document.getElementById('monthly-goal-add').addEventListener('click', () => {
  const inp = document.getElementById('monthly-goal-input');
  if (inp.value.trim()) { addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), inp.value); inp.value = ''; renderAllGoals(); }
});
document.getElementById('monthly-goal-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) { addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), e.target.value); e.target.value = ''; renderAllGoals(); }
});
document.getElementById('yearly-goal-add').addEventListener('click', () => {
  const inp = document.getElementById('yearly-goal-input');
  if (inp.value.trim()) { addGoal(YEARLY_GOALS_KEY, currentYearKey(), inp.value); inp.value = ''; renderAllGoals(); }
});
document.getElementById('yearly-goal-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) { addGoal(YEARLY_GOALS_KEY, currentYearKey(), e.target.value); e.target.value = ''; renderAllGoals(); }
});

function renderGoalsArchive(storageKey, panelId, currentKey, formatLabel) {
  const panel = document.getElementById(panelId);
  const store = loadGoalsStore(storageKey);
  const pastKeys = Object.keys(store).filter(k => k < currentKey).sort().reverse();
  if (!pastKeys.length) {
    panel.innerHTML = '<div class="goals-archive-empty">Архив пуст</div>';
    return;
  }
  panel.innerHTML = pastKeys.map(key => {
    const goals = store[key] || [];
    const done = goals.filter(g => g.done).length;
    return `
      <div class="goals-archive-period">
        <div class="goals-archive-period-head">
          <span class="goals-archive-period-title">${formatLabel(key)}</span>
          <span class="goals-archive-period-stat">${done}/${goals.length}</span>
        </div>
        <div class="goals-archive-period-list">
          ${goals.map(g => `
            <div class="goals-archive-item ${g.done ? 'archive-done' : 'archive-undone'}">
              <span>${g.done ? '✅' : '⬜'}</span>
              <span>${escHtml(g.text)}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function toggleMonthlyArchive() {
  const panel = document.getElementById('monthly-archive-panel');
  const btn = document.getElementById('monthly-archive-btn');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  btn.classList.toggle('active', !isOpen);
  if (!isOpen) renderGoalsArchive(MONTHLY_GOALS_KEY, 'monthly-archive-panel', currentMonthKey(), formatMonthTitle);
}

function toggleYearlyArchive() {
  const panel = document.getElementById('yearly-archive-panel');
  const btn = document.getElementById('yearly-archive-btn');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  btn.classList.toggle('active', !isOpen);
  if (!isOpen) renderGoalsArchive(YEARLY_GOALS_KEY, 'yearly-archive-panel', currentYearKey(), k => k + ' год');
}

renderAllGoals();

// ── Stats ─────────────────────────────────────────────────────────────────
function getStat(key) { return parseInt(localStorage.getItem('prod_stat_' + key) || '0', 10); }

function animateStat(id, target, duration = 800) {
  const el    = document.getElementById(id);
  const start = performance.now();
  (function step(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(t * target);
    if (t < 1) requestAnimationFrame(step);
  })(performance.now());
}

animateStat('stat-go',      getStat('go'));
animateStat('stat-tasks',   getStat('tasks'));
animateStat('stat-duo',     getStat('duo'));

const statMeta = {
  'stat-go':      { key: 'go',      max: 30 },
  'stat-tasks':   { key: 'tasks',   max: 10 },
  'stat-duo':     { key: 'duo',     max: 2  },
};
Object.entries(statMeta).forEach(([id, { key, max }]) => {
  const el = document.getElementById(id);
  el.parentElement.style.cursor = 'pointer';
  el.parentElement.title = 'Клик — +1, Shift+Клик — −1';
  el.parentElement.addEventListener('click', e => {
    let val = getStat(key);
    val = e.shiftKey ? Math.max(0, val - 1) : Math.min(max, val + 1);
    localStorage.setItem('prod_stat_' + key, val);
    el.textContent = val;
  });
});

// ── Early Start Tracker (7:00–8:00) ─────────────────────────────────────
const EARLY_KEY = 'prod_early_start_v1';

function loadEarlyData() {
  try { return JSON.parse(localStorage.getItem(EARLY_KEY) || '{}'); } catch { return {}; }
}
function saveEarlyData(d) { localStorage.setItem(EARLY_KEY, JSON.stringify(d)); }

function getEarlyMonthKey() { return currentMonthKey(); }

function getDaysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function checkEarlyLogin() {
  const now = new Date();
  const h = now.getHours();
  const today = todayStr();
  const data = loadEarlyData();
  const mk = getEarlyMonthKey();

  if (!data[mk]) data[mk] = {};
  // already recorded today
  if (data[mk][today]) return;

  // check if current time is between 7:00 and 7:59
  if (h >= 7 && h < 8) {
    data[mk][today] = { time: now.toISOString(), success: true };
    saveEarlyData(data);
    renderEarlyStat();
    checkEarlyGoalCompletion();
  }
}

function getEarlyCount(monthKey) {
  const data = loadEarlyData();
  const month = data[monthKey] || {};
  return Object.values(month).filter(d => d.success).length;
}

function renderEarlyStat() {
  const mk = getEarlyMonthKey();
  const count = getEarlyCount(mk);
  const total = getDaysInMonth(mk);

  const el = document.getElementById('stat-early');
  const label = document.getElementById('stat-early-label');
  const sub = document.getElementById('stat-early-sub');

  el.textContent = count;
  label.textContent = `Ранний старт / ${total}`;

  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const today = todayStr();
  const data = loadEarlyData();
  const todayLogged = data[mk] && data[mk][today];
  sub.textContent = todayLogged ? `сегодня ✓ · ${pct}%` : `сегодня — · ${pct}%`;
}

// Ensure early start goal exists for current month
function ensureEarlyGoal() {
  const mk = currentMonthKey();
  const goals = getGoalsForPeriod(MONTHLY_GOALS_KEY, mk);
  const earlyGoalText = 'Начинать рабочий день с 7 утра каждый день';
  const hasEarly = goals.some(g => g.recurring === 'early-start');
  if (!hasEarly) {
    goals.push({
      id: uid(),
      text: earlyGoalText,
      icon: '⏰',
      done: false,
      createdAt: todayStr(),
      recurring: 'early-start',
    });
    setGoalsForPeriod(MONTHLY_GOALS_KEY, mk, goals);
  }
}

function checkEarlyGoalCompletion() {
  const mk = currentMonthKey();
  const count = getEarlyCount(mk);
  const total = getDaysInMonth(mk);
  const goals = getGoalsForPeriod(MONTHLY_GOALS_KEY, mk);
  const earlyGoal = goals.find(g => g.recurring === 'early-start');
  if (!earlyGoal) return;

  // auto-complete if all days of month so far have early start
  const today = new Date();
  const dayOfMonth = today.getDate();
  if (count >= dayOfMonth && dayOfMonth === total) {
    earlyGoal.done = true;
    setGoalsForPeriod(MONTHLY_GOALS_KEY, mk, goals);
    renderAllGoals();
  }
}

// Override carryOverGoals to always include early-start recurring goal
(function patchCarryOver() {
  const origCarry = carryOverGoals;
  carryOverGoals = function(storageKey, currentKey) {
    origCarry(storageKey, currentKey);
    if (storageKey === MONTHLY_GOALS_KEY) ensureEarlyGoal();
  };
})();

ensureEarlyGoal();
checkEarlyLogin();
renderEarlyStat();

// re-check every minute (in case user leaves page open across 7:00)
setInterval(() => { checkEarlyLogin(); renderEarlyStat(); }, 60000);

// ── Quote Banner ──────────────────────────────────────────────────────────
let allQuotes    = [];
let quoteIndex   = 0;
let quoteChangeAt = 0;
const QUOTE_INTERVAL = 60 * 60 * 1000;

function showQuote(q) {
  document.getElementById('quote-text').textContent = q.quote;
  const expl = document.getElementById('quote-expl');
  expl.textContent  = q.explanation || '';
  expl.style.display = q.explanation ? '' : 'none';
  document.getElementById('quote-banner').classList.add('visible');
}

function nextQuote() {
  if (!allQuotes.length) return;
  quoteIndex++;
  if (quoteIndex >= allQuotes.length) {
    shuffleArray(allQuotes);
    quoteIndex = 0;
  }
  quoteChangeAt = Date.now() + QUOTE_INTERVAL;
  showQuote(allQuotes[quoteIndex]);
}

function updateCountdown() {
  const el = document.getElementById('quote-countdown');
  if (!el || !allQuotes.length) return;
  const remaining = Math.max(0, quoteChangeAt - Date.now());
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  el.textContent = `смена через ${m}:${String(s).padStart(2, '0')}`;
  if (remaining === 0) nextQuote();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

fetch('/quotes.json')
  .then(r => { if (!r.ok) throw new Error(); return r.json(); })
  .then(data => {
    if (!Array.isArray(data) || !data.length) return;
    allQuotes = data.slice();
    shuffleArray(allQuotes);
    quoteIndex    = 0;
    quoteChangeAt = Date.now() + QUOTE_INTERVAL;
    showQuote(allQuotes[quoteIndex]);
    setInterval(updateCountdown, 1000);
    updateCountdown();
  })
  .catch(() => {});

// ── Reading List ───────────────────────────────────────────────────────
const READING_KEY = 'prod_reading_v1';
const READING_BOOKS_KEY = 'prod_reading_books_v1';

function loadReadingBooks() {
  try { return JSON.parse(localStorage.getItem(READING_BOOKS_KEY) || '[]'); } catch { return []; }
}
function saveReadingBooks(books) { localStorage.setItem(READING_BOOKS_KEY, JSON.stringify(books)); }

function loadReading() {
  try { return JSON.parse(localStorage.getItem(READING_KEY) || '{}'); } catch { return {}; }
}
function saveReading(data) { localStorage.setItem(READING_KEY, JSON.stringify(data)); }

function getBookState(data, id) {
  return data[id] || { status: 'waiting', page: 0, startedAt: null };
}

let _readingEditMode = false;
const expandedBooks = {};

function toggleBookExpand(id) {
  expandedBooks[id] = !expandedBooks[id];
  renderReadingList();
}

function toggleReadingEditMode() {
  _readingEditMode = !_readingEditMode;
  renderReadingList();
}

function addBook() {
  const titleEl = document.getElementById('reading-add-title');
  const authorEl = document.getElementById('reading-add-author');
  const typeEl = document.getElementById('reading-add-type');
  if (!titleEl) return;
  const title = titleEl.value.trim();
  const author = authorEl.value.trim();
  const type = typeEl.value.trim() || 'роман';
  if (!title) return;
  const books = loadReadingBooks();
  const id = 'book-' + Date.now();
  books.push({ id, title, author, type });
  saveReadingBooks(books);
  titleEl.value = '';
  authorEl.value = '';
  typeEl.value = '';
  renderReadingList();
}

function removeBook(id) {
  if (!confirm('Удалить книгу из списка?')) return;
  let books = loadReadingBooks();
  const book = books.find(b => b.id === id);
  books = books.filter(b => b.id !== id);
  saveReadingBooks(books);
  const data = loadReading();
  delete data[id];
  if (book && book.subItems) book.subItems.forEach(s => delete data[s.id]);
  saveReading(data);
  renderReadingList();
}

function moveBook(id, dir) {
  const books = loadReadingBooks();
  const idx = books.findIndex(b => b.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= books.length) return;
  [books[idx], books[newIdx]] = [books[newIdx], books[idx]];
  saveReadingBooks(books);
  renderReadingList();
}

function startEditBook(id) {
  const books = loadReadingBooks();
  const book = books.find(b => b.id === id);
  if (!book) return;
  const el = document.getElementById('book-row-' + id);
  if (!el) return;
  el.innerHTML = `
    <div class="book-edit-form">
      <input class="book-edit-input" id="edit-title-${id}" value="${(book.title || '').replace(/"/g, '&quot;')}" placeholder="Название" />
      <input class="book-edit-input" id="edit-author-${id}" value="${(book.author || '').replace(/"/g, '&quot;')}" placeholder="Автор" />
      <input class="book-edit-input book-edit-type" id="edit-type-${id}" value="${(book.type || '').replace(/"/g, '&quot;')}" placeholder="Тип" />
      <button class="book-edit-save" onclick="saveEditBook('${id}')">OK</button>
      <button class="book-edit-cancel" onclick="renderReadingList()">✕</button>
    </div>`;
}

function saveEditBook(id) {
  const books = loadReadingBooks();
  const book = books.find(b => b.id === id);
  if (!book) return;
  const title = document.getElementById('edit-title-' + id).value.trim();
  const author = document.getElementById('edit-author-' + id).value.trim();
  const type = document.getElementById('edit-type-' + id).value.trim();
  if (!title) return;
  book.title = title;
  book.author = author;
  book.type = type || 'роман';
  saveReadingBooks(books);
  renderReadingList();
}

function clearReadingList() {
  if (!confirm('Очистить весь список чтения? Все книги и прогресс будут удалены.')) return;
  saveReadingBooks([]);
  saveReading({});
  renderReadingList();
}

function cycleBookStatus(id) {
  const books = loadReadingBooks();
  const data  = loadReading();
  const state = getBookState(data, id);
  const order = ['waiting', 'reading', 'done'];
  const next  = order[(order.indexOf(state.status) + 1) % order.length];

  if (next === 'reading') {
    books.forEach(b => {
      if (b.id !== id && getBookState(data, b.id).status === 'reading') {
        data[b.id] = { ...getBookState(data, b.id), status: 'done' };
      }
    });
  }

  data[id] = {
    ...state,
    status: next,
    startedAt: next === 'reading' && !state.startedAt ? todayStr() : state.startedAt,
  };

  const book = books.find(b => b.id === id);
  if (book && book.subItems) {
    if (next === 'done') book.subItems.forEach(s => { data[s.id] = { ...getBookState(data, s.id), status: 'done' }; });
    if (next === 'waiting') book.subItems.forEach(s => { data[s.id] = { ...getBookState(data, s.id), status: 'waiting' }; });
  }

  saveReading(data);
  renderReadingList();
}

function toggleSubItemStatus(bookId, subId) {
  const books = loadReadingBooks();
  const data = loadReading();
  const state = getBookState(data, subId);
  const next = state.status === 'done' ? 'waiting' : 'done';
  data[subId] = { ...state, status: next };
  const book = books.find(b => b.id === bookId);
  if (book && book.subItems) {
    const allDone = book.subItems.every(s => getBookState(data, s.id).status === 'done');
    const anyStarted = book.subItems.some(s => getBookState(data, s.id).status !== 'waiting');
    const parentState = getBookState(data, book.id);
    if (allDone) data[book.id] = { ...parentState, status: 'done' };
    else if (anyStarted && parentState.status === 'done') data[book.id] = { ...parentState, status: 'reading', startedAt: parentState.startedAt || todayStr() };
  }
  saveReading(data);
  renderReadingList();
}

function updateBookPage(id, value) {
  const data  = loadReading();
  const state = getBookState(data, id);
  const page  = Math.max(0, parseInt(value, 10) || 0);
  data[id] = { ...state, page };
  saveReading(data);
  const label = document.getElementById('book-page-since-' + id);
  if (label && state.startedAt) label.textContent = `с ${state.startedAt}`;
}

const STATUS_ICON = { waiting: '⬜', reading: '🔄', done: '✅' };

function renderReadingList() {
  const books     = loadReadingBooks();
  const data      = loadReading();
  const total     = books.length;
  const doneCount = books.filter(b => getBookState(data, b.id).status === 'done').length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  document.getElementById('reading-done-count').textContent = doneCount;
  document.getElementById('reading-total-count').textContent = total;
  document.getElementById('reading-progress-fill').style.width = pct + '%';

  const container = document.getElementById('reading-books');
  container.innerHTML = '';

  if (total === 0) {
    container.innerHTML = '<div class="reading-empty">Список пуст. Добавьте книги для чтения.</div>';
  }

  books.forEach((book, idx) => {
    const state   = getBookState(data, book.id);
    const { status, page, startedAt } = state;
    const hasSubs = book.subItems && book.subItems.length > 0;
    const isExpanded = expandedBooks[book.id];

    const el = document.createElement('div');
    el.className = 'book-item book-' + status;
    el.id = 'book-row-' + book.id;

    const pageRow = status === 'reading' ? `
      <div class="book-page-row">
        <span class="book-page-label">Страница:</span>
        <input
          class="book-page-input"
          id="book-page-input-${book.id}"
          type="number"
          min="0"
          value="${page}"
          onchange="updateBookPage('${book.id}', this.value)"
        />
        <span class="book-page-since" id="book-page-since-${book.id}">${startedAt ? 'с ' + startedAt : ''}</span>
      </div>` : '';

    const subsDoneCount = hasSubs ? book.subItems.filter(s => getBookState(data, s.id).status === 'done').length : 0;
    const subsCounter = hasSubs ? `<span class="book-subs-counter">${subsDoneCount}/${book.subItems.length}</span>` : '';
    const expandBtn = hasSubs ? `<button class="book-expand-btn${isExpanded ? ' expanded' : ''}" onclick="toggleBookExpand('${book.id}')" title="Раскрыть содержание">▸</button>` : '';

    const editBtns = _readingEditMode ? `
      <div class="book-edit-actions">
        <button class="book-move-btn" onclick="moveBook('${book.id}', -1)" title="Вверх" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="book-move-btn" onclick="moveBook('${book.id}', 1)" title="Вниз" ${idx === total - 1 ? 'disabled' : ''}>▼</button>
        <button class="book-edit-btn" onclick="startEditBook('${book.id}')" title="Редактировать">✎</button>
        <button class="book-remove-btn" onclick="removeBook('${book.id}')" title="Удалить">✕</button>
      </div>` : '';

    el.innerHTML = `
      <button class="book-status-btn" onclick="cycleBookStatus('${book.id}')" title="Изменить статус">
        ${STATUS_ICON[status]}
      </button>
      <div class="book-body">
        <div class="book-main-row">
          <span class="book-num">${idx + 1}.</span>
          <span class="book-title">${book.title}</span>
          <span class="book-type">${book.type || ''}</span>
          ${subsCounter}
          ${expandBtn}
          ${editBtns}
        </div>
        <div class="book-author">${book.author || ''}</div>
        ${pageRow}
      </div>`;

    container.appendChild(el);

    if (hasSubs && isExpanded) {
      const subsEl = document.createElement('div');
      subsEl.className = 'book-subs-list';
      book.subItems.forEach(sub => {
        const subState = getBookState(data, sub.id);
        const subDone = subState.status === 'done';
        const subItem = document.createElement('div');
        subItem.className = 'book-sub-item' + (subDone ? ' sub-done' : '');
        subItem.innerHTML = `
          <button class="book-sub-checkbox${subDone ? ' checked' : ''}" onclick="toggleSubItemStatus('${book.id}','${sub.id}')">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="book-sub-title">${sub.title}</span>`;
        subsEl.appendChild(subItem);
      });
      container.appendChild(subsEl);
    }
  });

  // Add book form (always visible at bottom)
  const addForm = document.createElement('div');
  addForm.className = 'reading-add-form';
  addForm.innerHTML = `
    <input class="reading-add-input" id="reading-add-title" placeholder="Название книги" />
    <input class="reading-add-input reading-add-author" id="reading-add-author" placeholder="Автор" />
    <input class="reading-add-input reading-add-type-input" id="reading-add-type" placeholder="Тип" />
    <button class="reading-add-btn" onclick="addBook()">+</button>`;
  container.appendChild(addForm);

  // Bind Enter on title input
  setTimeout(() => {
    const inp = document.getElementById('reading-add-title');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addBook(); });
  }, 0);
}

renderReadingList();

// ── Training Plan Target ─────────────────────────────────────────────────
function getTodayDateStr() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTrainingForDate(dateStr) {
  return TRAINING_SCHEDULE.find(t => t.date === dateStr) || null;
}

function getNextTraining() {
  const today = getTodayDateStr();
  return TRAINING_SCHEDULE.find(t => t.date > today) || null;
}

function getTrainingWeek(weekNum) {
  return TRAINING_SCHEDULE.filter(t => t.week === weekNum);
}

function getWeek5kTarget(weekDays) {
  for (const d of weekDays) {
    const m = d.workout.match(/цель:\s*([\d:]+)/);
    if (m) return m[1];
  }
  return null;
}

function classifyWorkout(workout) {
  if (/^Отдых/.test(workout)) return 'rest';
  if (/Интервал|Ускорен/i.test(workout)) return 'intervals';
  if (/Темповый/i.test(workout)) return 'tempo';
  if (/5 вёрст|ЦЕЛЕВОЙ/i.test(workout)) return 'race';
  if (/Длинный/i.test(workout)) return 'long';
  return 'easy';
}

function renderTrainingToday() {
  const container = document.getElementById('training-today');
  if (!container) return;
  if (!TRAINING_SCHEDULE.length) {
    container.innerHTML = '<div class="training-today-block tt-loading">Загрузка плана тренировок...</div>';
    return;
  }

  const todayStr = getTodayDateStr();
  let entry = getTrainingForDate(todayStr);
  let isUpcoming = false;
  if (!entry) {
    entry = getNextTraining();
    isUpcoming = !!entry;
  }
  if (!entry) {
    container.innerHTML = '<div class="training-today-block tt-empty">План тренировок завершён</div>';
    return;
  }

  const weekDays = getTrainingWeek(entry.week);
  const target5k = getWeek5kTarget(weekDays);
  const meta = TRAINING_PLAN_META;
  const progressPct = Math.round(((entry.week - 1) / meta.totalWeeks) * 100);
  const workoutType = classifyWorkout(entry.workout);
  const isRest = workoutType === 'rest';

  const phaseInfo = meta.phases.find(p =>
    entry.week >= p.weeks[0] && entry.week <= p.weeks[1]
  );
  const phaseName = phaseInfo ? phaseInfo.name : '';

  const weekScheduleHtml = weekDays.map(d => {
    const isCurrent = d.date === entry.date;
    const wType = classifyWorkout(d.workout);
    const shortLabel = /^Отдых/.test(d.workout) ? 'Отдых'
      : d.workout.length > 30 ? d.workout.substring(0, 28) + '…' : d.workout;
    return `<div class="tw-day ${isCurrent ? 'tw-day-today' : ''} tw-day-${wType}">
      <span class="tw-day-name">${d.day}</span>
      <span class="tw-day-workout" title="${d.workout.replace(/"/g, '&quot;')}">${shortLabel}</span>
    </div>`;
  }).join('');

  const todayLabel = isUpcoming
    ? `Старт плана: <strong>${formatDateRu(entry.date)}</strong>, ${entry.day}`
    : 'Сегодня:';

  container.innerHTML = `
    <div class="training-today-block">
      <div class="tt-header">
        <div class="tt-phase-badge tt-phase-${phaseInfo ? phaseInfo.id : 2}">${phaseName}</div>
        <div class="tt-week-label">Неделя ${entry.week} / ${meta.totalWeeks}</div>
        ${target5k ? `<div class="tt-target5k">5К цель: <strong>${target5k}</strong></div>` : ''}
        <div class="tt-header-actions">
          <div class="tt-record">Рекорд: ${meta.currentRecord} → ${meta.finalTarget}</div>
          <button class="tt-btn tt-records-btn" onclick="toggleRecordsModal()" title="Рекорды 5 вёрст">Рекорды</button>
          <button class="tt-btn tt-refresh-btn" onclick="refreshTrainingData()" title="Обновить данные">↻</button>
        </div>
      </div>
      <div class="tt-progress-bar">
        <div class="tt-progress-fill" style="width:${progressPct}%"></div>
      </div>
      <div class="tt-today ${isRest ? 'tt-today-rest' : ''} tt-today-${workoutType}">
        <span class="tt-today-label">${todayLabel}</span>
        <span class="tt-today-workout">${entry.workout}</span>
      </div>
      <div class="tw-week-schedule">${weekScheduleHtml}</div>
    </div>`;
}

function formatDateRu(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

async function refreshTrainingData() {
  const btn = document.querySelector('.tt-refresh-btn');
  if (btn) { btn.classList.add('tt-spinning'); btn.disabled = true; }
  await initTrainingData();
  renderTrainingToday();
  if (btn) { setTimeout(() => { btn.classList.remove('tt-spinning'); btn.disabled = false; }, 400); }
}

// ── Records Modal ────────────────────────────────────────────────────────
let recordsModalOpen = false;
let recFilterGender = 'all';   // 'all' | 'М' | 'Ж'
let recSearchQuery = '';

function toggleRecordsModal() {
  recordsModalOpen = !recordsModalOpen;
  if (recordsModalOpen) { recFilterGender = 'all'; recSearchQuery = ''; renderRecordsModal(); }
  else closeRecordsModal();
}

function closeRecordsModal() {
  recordsModalOpen = false;
  const modal = document.getElementById('records-modal');
  if (modal) modal.remove();
}

function setRecGenderFilter(gender) {
  recFilterGender = gender;
  updateRecordsTable();
}

function onRecSearchInput(val) {
  recSearchQuery = val.toLowerCase();
  updateRecordsTable();
}

function getFilteredRecords() {
  return RECORDS_DATA.filter(r => {
    if (recFilterGender !== 'all' && r.gender !== recFilterGender) return false;
    if (recSearchQuery && !r.location.toLowerCase().includes(recSearchQuery)) return false;
    return true;
  });
}

function buildRecordsRows(filtered) {
  return filtered.map((r, i) => {
    const isMale = r.gender === 'М';
    const isRostov = r.location.includes('Ростов-на-Дону');
    const genderClass = isMale ? 'rec-male' : 'rec-female';
    const rostovClass = isRostov ? ' rec-rostov' : '';
    return `<tr class="${genderClass}${rostovClass}">
      <td class="rec-num">${i + 1}</td>
      <td class="rec-loc">${r.location}</td>
      <td class="rec-time">${r.time}</td>
      <td class="rec-athlete">${r.athlete}</td>
      <td class="rec-gender">${r.gender}</td>
      <td class="rec-date">${r.date}</td>
      <td class="rec-pace">${r.pace}</td>
    </tr>`;
  }).join('');
}

function updateRecordsTable() {
  const tbody = document.getElementById('records-tbody');
  const countEl = document.getElementById('records-count');
  if (!tbody) return;
  const filtered = getFilteredRecords();
  tbody.innerHTML = buildRecordsRows(filtered);
  if (countEl) countEl.textContent = `${filtered.length} / ${RECORDS_DATA.length}`;
}

function renderRecordsModal() {
  closeRecordsModal();
  if (!RECORDS_DATA.length) return;
  recordsModalOpen = true;

  const modal = document.createElement('div');
  modal.id = 'records-modal';
  modal.className = 'records-modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) closeRecordsModal(); };

  const filtered = getFilteredRecords();

  modal.innerHTML = `
    <div class="records-modal-content">
      <div class="records-modal-header">
        <h3>Рекорды трасс 5 вёрст</h3>
        <span class="records-count" id="records-count">${filtered.length} / ${RECORDS_DATA.length}</span>
        <button class="records-modal-close" onclick="closeRecordsModal()">✕</button>
      </div>
      <div class="records-filters">
        <div class="rec-gender-filter">
          <button class="rec-filter-btn ${recFilterGender === 'all' ? 'active' : ''}" onclick="setRecGenderFilter('all')">Все</button>
          <button class="rec-filter-btn rec-filter-male ${recFilterGender === 'М' ? 'active' : ''}" onclick="setRecGenderFilter('М')">М</button>
          <button class="rec-filter-btn rec-filter-female ${recFilterGender === 'Ж' ? 'active' : ''}" onclick="setRecGenderFilter('Ж')">Ж</button>
        </div>
        <input type="text" class="rec-search-input" placeholder="Поиск по месту старта…" value="${recSearchQuery}" oninput="onRecSearchInput(this.value)" />
      </div>
      <div class="records-table-wrap">
        <table class="records-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Старт</th>
              <th>Время</th>
              <th>Атлет</th>
              <th>Пол</th>
              <th>Дата</th>
              <th>Темп</th>
            </tr>
          </thead>
          <tbody id="records-tbody">${buildRecordsRows(filtered)}</tbody>
        </table>
      </div>
      <div class="records-legend">
        <span class="rec-legend-item"><span class="rec-legend-dot rec-legend-male"></span> Мужчины</span>
        <span class="rec-legend-item"><span class="rec-legend-dot rec-legend-female"></span> Женщины</span>
        <span class="rec-legend-item"><span class="rec-legend-dot rec-legend-rostov"></span> Ростов-на-Дону</span>
      </div>
    </div>`;

  document.body.appendChild(modal);
}

// ── Init training data on load ───────────────────────────────────────────
initTrainingData().then(() => {
  renderTrainingToday();
});

// ── Running Progress ──────────────────────────────────────────────────────
const RUNNING_KEY = 'prod_running_v1';

const RUN_DISTANCES = [
  { id: '5km',      label: '5 КМ',        km: 5       },
  { id: '10km',     label: '10 КМ',       km: 10      },
  { id: 'half',     label: 'ПОЛУМАРАФОН', km: 21.0975 },
  { id: 'marathon', label: 'МАРАФОН',     km: 42.195  },
];

function loadRunning() {
  try { return JSON.parse(localStorage.getItem(RUNNING_KEY) || '{}'); } catch { return {}; }
}
function saveRunning(data) { localStorage.setItem(RUNNING_KEY, JSON.stringify(data)); }

function parseRunTime(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(p => isNaN(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function fmtRunTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function calcPace(secs, km) {
  const secPerKm = secs / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtRunDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function submitRunResult(distId) {
  const timeInput = document.getElementById('run-input-' + distId);
  const dateInput = document.getElementById('run-date-' + distId);
  const timeStr = timeInput ? timeInput.value.trim() : '';
  const dateStr = dateInput ? dateInput.value : '';
  if (!timeStr) return;
  const secs = parseRunTime(timeStr);
  if (!secs) { if (timeInput) timeInput.style.borderColor = 'var(--red)'; return; }
  const data = loadRunning();
  if (!data[distId]) data[distId] = [];
  data[distId].push({ secs, date: dateStr, addedAt: new Date().toISOString() });
  data[distId].sort((a, b) => a.secs - b.secs);
  saveRunning(data);
  renderRunning();
}

function deleteRunResult(distId, idx) {
  const data = loadRunning();
  if (!data[distId]) return;
  data[distId].splice(idx, 1);
  saveRunning(data);
  renderRunning();
}

// edit state: { distId, idx } or null
let runEditState = null;

function startEditRun(distId, idx) {
  runEditState = { distId, idx };
  renderRunning();
}

function cancelEditRun() {
  runEditState = null;
  renderRunning();
}

function saveEditRun(distId, idx) {
  const timeInput = document.getElementById('run-edit-time');
  const dateInput = document.getElementById('run-edit-date');
  const timeStr = timeInput ? timeInput.value.trim() : '';
  const dateStr = dateInput ? dateInput.value : '';
  if (!timeStr) return;
  const secs = parseRunTime(timeStr);
  if (!secs) { if (timeInput) timeInput.style.borderColor = 'var(--red)'; return; }
  const data = loadRunning();
  if (!data[distId] || data[distId][idx] === undefined) return;
  data[distId][idx] = { ...data[distId][idx], secs, date: dateStr };
  data[distId].sort((a, b) => a.secs - b.secs);
  saveRunning(data);
  runEditState = null;
  renderRunning();
}

function buildRunEditForm(distId, idx, r) {
  return `
    <div class="run-edit-form">
      <input type="text" class="run-time-input" id="run-edit-time" value="${fmtRunTime(r.secs)}" placeholder="мм:сс" />
      <input type="date" class="run-date-input" id="run-edit-date" value="${r.date || ''}" />
      <button class="run-add-btn" onclick="saveEditRun('${distId}',${idx})" title="Сохранить">✓</button>
      <button class="run-hist-del" onclick="cancelEditRun()" title="Отмена">✕</button>
    </div>`;
}

function renderRunning() {
  const data = loadRunning();
  const grid = document.getElementById('running-grid');
  if (!grid) return;
  grid.innerHTML = '';

  RUN_DISTANCES.forEach(dist => {
    const results = data[dist.id] || [];
    const best = results[0] || null;

    const isEditingBest = runEditState && runEditState.distId === dist.id && runEditState.idx === 0;

    let bestHtml = '';
    if (best) {
      if (isEditingBest) {
        bestHtml = buildRunEditForm(dist.id, 0, best);
      } else {
        bestHtml = `
          <div class="run-time-main">${fmtRunTime(best.secs)}</div>
          <div class="run-pace-main">⌀ ${calcPace(best.secs, dist.km)} /км</div>
          ${best.date ? `<div class="run-date-main">${fmtRunDate(best.date)}</div>` : ''}
          <button class="run-edit-btn" onclick="startEditRun('${dist.id}',0)" title="Редактировать">✎</button>`;
      }
    } else {
      bestHtml = `<div class="run-empty">—</div>`;
    }

    const histHtml = results.length > 1
      ? results.slice(1).map((r, i) => {
          const realIdx = i + 1;
          const isEditingThis = runEditState && runEditState.distId === dist.id && runEditState.idx === realIdx;
          if (isEditingThis) {
            return `<div class="run-hist-item">${buildRunEditForm(dist.id, realIdx, r)}</div>`;
          }
          return `
            <div class="run-hist-item">
              <span class="run-hist-time">${fmtRunTime(r.secs)}</span>
              <span class="run-hist-pace">${calcPace(r.secs, dist.km)}/км</span>
              ${r.date ? `<span class="run-hist-date">${fmtRunDate(r.date)}</span>` : '<span class="run-hist-date"></span>'}
              <button class="run-edit-btn" onclick="startEditRun('${dist.id}',${realIdx})" title="Редактировать">✎</button>
              <button class="run-hist-del" onclick="deleteRunResult('${dist.id}',${realIdx})" title="Удалить">×</button>
            </div>`;
        }).join('')
      : '';

    const card = document.createElement('div');
    card.className = 'run-card' + (best ? ' run-card-has-result' : '');
    card.innerHTML = `
      <div class="run-dist-label">${dist.label}</div>
      <div class="run-best-block">${bestHtml}</div>
      ${histHtml ? `<div class="run-history">${histHtml}</div>` : ''}
      <div class="run-add-row">
        <input type="text" class="run-time-input" id="run-input-${dist.id}" placeholder="мм:сс" />
        <input type="date" class="run-date-input" id="run-date-${dist.id}" />
        <button class="run-add-btn" onclick="submitRunResult('${dist.id}')" title="Добавить результат">+</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

renderRunning();

// ── Productivity Stats ───────────────────────────────────────────────────
const PROD_DAILY_KEY = 'prod_daily_snapshot_v1';
const MAX_TASK_IN_DAY = 10;
let currentProdPeriod = 'week';

function loadDailySnapshots() {
  try { return JSON.parse(localStorage.getItem(PROD_DAILY_KEY) || '{}'); } catch { return {}; }
}
function saveDailySnapshots(d) { localStorage.setItem(PROD_DAILY_KEY, JSON.stringify(d)); }

function snapshotToday() {
  const today = todayStr();
  const snapshots = loadDailySnapshots();
  const history = loadHistory();
  const tasks = loadTasks();

  const todayCompleted = history.filter(h => h.doneAt && h.doneAt.slice(0, 10) === today);
  const totalMs = todayCompleted.reduce((s, h) => s + (h.workedMs || 0), 0);

  snapshots[today] = {
    completed: todayCompleted.length,
    remaining: tasks.length,
    totalMs,
    goScripts: getStat('go'),
    workTasks: getStat('tasks'),
    journalDays: getStat('journal'),
  };
  saveDailySnapshots(snapshots);
}

function getDailyStats(dateStr) {
  const snapshots = loadDailySnapshots();
  if (snapshots[dateStr]) return snapshots[dateStr];
  // fallback: derive from history
  const history = loadHistory();
  const dayCompleted = history.filter(h => h.doneAt && h.doneAt.slice(0, 10) === dateStr);
  const totalMs = dayCompleted.reduce((s, h) => s + (h.workedMs || 0), 0);
  return { completed: dayCompleted.length, remaining: 0, totalMs, goScripts: 0, workTasks: 0, journalDays: 0 };
}

function calcProductivity(completed, remaining) {
  let total = completed + remaining;
  if (total === 0) return 0;
  // Max count of task for day is 10
  total = total > MAX_TASK_IN_DAY ? MAX_TASK_IN_DAY : total;

  return Math.round((completed / total) * 100);
}

function localDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getDateRange(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];
  let days;
  if (period === 'week') days = 7;
  else if (period === 'month') days = 30;
  else days = 365;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(localDateStr(d));
  }
  return dates;
}

function getStreak() {
  const history = loadHistory();
  const doneByDay = {};
  history.forEach(h => {
    if (h.doneAt) {
      const d = h.doneAt.slice(0, 10);
      doneByDay[d] = (doneByDay[d] || 0) + 1;
    }
  });
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (doneByDay[ds]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function setProdPeriod(period) {
  currentProdPeriod = period;
  document.querySelectorAll('.prod-tab').forEach(t => t.classList.toggle('active', t.dataset.period === period));
  document.getElementById('prod-day-detail').style.display = 'none';
  renderProdStats();
}

function renderProdStats() {
  snapshotToday();
  renderProdToday();
  renderProdChart();
}

function renderProdToday() {
  const today = todayStr();
  const stats = getDailyStats(today);
  const pct = calcProductivity(stats.completed, stats.remaining);
  const streak = getStreak();

  const history = loadHistory();
  const last7 = getDateRange('week');
  const weekTotal = last7.reduce((s, d) => {
    return s + history.filter(h => h.doneAt && h.doneAt.slice(0, 10) === d).length;
  }, 0);
  const weekAvg = (weekTotal / 7).toFixed(1);

  const el = document.getElementById('prod-today');
  el.innerHTML = `
    <div class="prod-metric prod-metric-main">
      <div class="prod-metric-ring">
        <svg viewBox="0 0 36 36" class="prod-ring-svg">
          <path class="prod-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="prod-ring-fill" stroke-dasharray="${pct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <span class="prod-ring-value">${pct}%</span>
      </div>
      <div class="prod-metric-info">
        <div class="prod-metric-label">Продуктивность сегодня</div>
        <div class="prod-metric-sub">${stats.completed} выполнено · ${stats.remaining} осталось</div>
      </div>
    </div>
    <div class="prod-metric">
      <div class="prod-metric-value" style="color:var(--cyan)">${stats.completed}</div>
      <div class="prod-metric-label">Задач сегодня</div>
    </div>
    <div class="prod-metric">
      <div class="prod-metric-value" style="color:var(--green)">${streak}</div>
      <div class="prod-metric-label">Серия дней</div>
    </div>
    <div class="prod-metric">
      <div class="prod-metric-value" style="color:var(--purple)">${weekAvg}</div>
      <div class="prod-metric-label">Среднее / день (7д)</div>
    </div>
    ${stats.totalMs > 0 ? `
    <div class="prod-metric">
      <div class="prod-metric-value" style="color:var(--yellow)">${fmtDuration(stats.totalMs)}</div>
      <div class="prod-metric-label">Время на задачи</div>
    </div>` : ''}`;
}

function showDayDetail(dateStr) {
  const stats = getDailyStats(dateStr);
  const history = loadHistory();
  const dayTasks = history.filter(h => h.doneAt && h.doneAt.slice(0, 10) === dateStr);
  const pct = calcProductivity(stats.completed, stats.remaining);
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });

  const el = document.getElementById('prod-day-detail');
  el.style.display = '';
  el.innerHTML = `
    <div class="prod-detail-header">
      <span class="prod-detail-date">${label}</span>
      <span class="prod-detail-pct">${pct}%</span>
      <button class="prod-detail-close" onclick="this.parentElement.parentElement.style.display='none'">✕</button>
    </div>
    <div class="prod-detail-stats">
      <span>Выполнено: <strong>${stats.completed}</strong></span>
      ${stats.totalMs > 0 ? `<span>Время: <strong>${fmtDuration(stats.totalMs)}</strong></span>` : ''}
    </div>
    ${dayTasks.length ? `<div class="prod-detail-tasks">${dayTasks.map(t =>
      `<div class="prod-detail-task">
        <span class="prod-detail-task-check">✓</span>
        <span>${escHtml(t.text)}</span>
        ${t.workedMs > 60000 ? `<span class="prod-detail-task-time">${fmtDuration(t.workedMs)}</span>` : ''}
      </div>`).join('')}</div>` : '<div class="prod-detail-empty">Нет данных за этот день</div>'}`;
}

function renderProdChart() {
  const canvas = document.getElementById('prod-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const dates = getDateRange(currentProdPeriod);
  const history = loadHistory();
  const today = localDateStr(new Date());
  const values = dates.map(d => history.filter(h => {
    if (!h.doneAt) return false;
    return localDateStr(new Date(h.doneAt)) === d;
  }).length);
  const maxVal = Math.max(1, ...values);

  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width;
  const H = 180;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 32, padR = 10, padT = 16, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // grid lines — не больше maxVal чтобы метки не дублировались
  const gridLines = Math.min(4, maxVal);
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + chartH - (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    const label = Math.round((maxVal / gridLines) * i);
    ctx.fillText(label, padL - 6, y + 3);
  }

  const isYear = currentProdPeriod === 'year';
  const isMonth = currentProdPeriod === 'month';

  if (isYear) {
    // aggregate by week for year view
    const weeks = [];
    const weekLabels = [];
    for (let i = 0; i < dates.length; i += 7) {
      const chunk = values.slice(i, i + 7);
      weeks.push(chunk.reduce((a, b) => a + b, 0));
      weekLabels.push(dates[i]);
    }
    const weekMax = Math.max(1, ...weeks);

    // re-draw grid for weekly max
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(Math.round((weekMax / gridLines) * i), padL - 6, y + 3);
    }

    const barW = Math.max(2, (chartW / weeks.length) - 2);
    const gap = (chartW - barW * weeks.length) / (weeks.length + 1);
    ctx.textAlign = 'center';

    weeks.forEach((val, i) => {
      const x = padL + gap + i * (barW + gap);
      const h = (val / weekMax) * chartH;
      const y = padT + chartH - h;

      const grad = ctx.createLinearGradient(x, y, x, padT + chartH);
      grad.addColorStop(0, 'rgba(6,182,212,.7)');
      grad.addColorStop(1, 'rgba(6,182,212,.15)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, 2);
      ctx.fill();

      // label every 4 weeks
      if (i % 4 === 0) {
        ctx.fillStyle = '#64748b';
        const d = new Date(weekLabels[i] + 'T00:00:00');
        ctx.fillText(d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), x + barW / 2, H - 6);
      }
    });

    // store click map for year (weekly buckets)
    canvas._clickData = { type: 'year-weeks', weeks, weekLabels, barW, gap, padL };
  } else {
    const barW = Math.max(2, (chartW / dates.length) - (isMonth ? 1.5 : 2));
    const gap = (chartW - barW * dates.length) / (dates.length + 1);

    ctx.textAlign = 'center';

    dates.forEach((dateStr, i) => {
      const val = values[i];
      const x = padL + gap + i * (barW + gap);

      const isToday = dateStr === today;

      const h = (val / maxVal) * chartH;
      const y = padT + chartH - h;
      const color = isToday ? 'rgba(167,139,250,' : 'rgba(6,182,212,';

      const grad = ctx.createLinearGradient(x, y, x, padT + chartH);
      grad.addColorStop(0, color + '.7)');
      grad.addColorStop(1, color + '.15)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      if (h > 0) {
        ctx.roundRect(x, y, barW, h, 2);
      } else {
        ctx.roundRect(x, padT + chartH - 1, barW, 1, 0);
      }
      ctx.fill();

      // x-axis labels
      const showLabel = isMonth
        ? (i % 5 === 0 || i === dates.length - 1)
        : true;
      if (showLabel) {
        ctx.fillStyle = isToday ? '#a78bfa' : '#64748b';
        const d = new Date(dateStr + 'T00:00:00');
        const label = isMonth
          ? d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
          : d.toLocaleDateString('ru-RU', { weekday: 'short' });
        ctx.fillText(label, x + barW / 2, H - 6);
      }
    });

    canvas._clickData = { type: 'days', dates, barW, gap, padL };
  }

  // click handler
  if (!canvas._hasClickHandler) {
    canvas.addEventListener('click', onProdChartClick);
    canvas._hasClickHandler = true;
  }
}

function onProdChartClick(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const cd = canvas._clickData;
  if (!cd) return;

  if (cd.type === 'days') {
    const { dates, barW, gap, padL } = cd;
    for (let i = 0; i < dates.length; i++) {
      const bx = padL + gap + i * (barW + gap);
      if (x >= bx && x <= bx + barW) {
        showDayDetail(dates[i]);
        return;
      }
    }
  }
}

renderProdStats();
window.addEventListener('resize', () => renderProdChart());

// ── Zen / Focus Mode ─────────────────────────────────────────────────────
let zenMode = false;
function toggleZenMode() {
  zenMode = !zenMode;
  document.body.classList.toggle('zen-active', zenMode);
}

// ── Keyboard Shortcuts ───────────────────────────────────────────────────
function toggleShortcutsHelp() {
  const el = document.getElementById('shortcuts-overlay');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'n':
      e.preventDefault();
      if (zenMode) toggleZenMode();
      document.getElementById('todo-input').focus();
      break;
    case 'f':
      e.preventDefault();
      toggleZenMode();
      break;
    case ' ': {
      e.preventDefault();
      const current = loadTasks().find(t => t.current);
      if (current) toggleTask(current.id);
      break;
    }
    case 'd':
      e.preventDefault();
      toggleDistractionPanel();
      break;
    case 'a':
      e.preventDefault();
      navigateToAdmin();
      break;
    case 'w':
      e.preventDefault();
      openWidgetSettings();
      break;
    case 'escape':
      e.preventDefault();
      closeWidgetSettings();
      closeRecordsModal();
      if (document.getElementById('shortcuts-overlay').style.display !== 'none')
        toggleShortcutsHelp();
      break;
    case 'home':
      e.preventDefault();
      scrollToEdge('top');
      break;
    case 'end':
      e.preventDefault();
      scrollToEdge('bottom');
      break;
    case '?':
      e.preventDefault();
      toggleShortcutsHelp();
      break;
    default:
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const cfg = getWidgetConfig();
        const order = cfg ? cfg.order : [...DEFAULT_WIDGET_ORDER];
        const visibleOrder = order.filter(id => {
          if (!cfg) return id === 'todo';
          return cfg.visible[id] !== false;
        });
        const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;
        if (visibleOrder[idx]) {
          const el = document.querySelector(`[data-widget="${visibleOrder[idx]}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
  }
});

function navigateToAdmin() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && user.role === 'admin') window.location.href = '/admin/';
}

function scrollToEdge(dir) {
  window.scrollTo({ top: dir === 'top' ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
}

// ── Scroll arrows ────────────────────────────────────────────────────────
function initScrollArrows() {
  const wrap = document.createElement('div');
  wrap.className = 'scroll-arrows';
  wrap.innerHTML = `
    <button class="scroll-arrow scroll-arrow-up" onclick="scrollToEdge('top')" title="В начало (Home)">&#x2191;</button>
    <button class="scroll-arrow scroll-arrow-down" onclick="scrollToEdge('bottom')" title="В конец (End)">&#x2193;</button>`;
  document.body.appendChild(wrap);

  const upBtn = wrap.querySelector('.scroll-arrow-up');
  const downBtn = wrap.querySelector('.scroll-arrow-down');

  function updateArrows() {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    upBtn.classList.toggle('visible', scrollY > 200);
    downBtn.classList.toggle('visible', scrollY < maxScroll - 200);
  }
  window.addEventListener('scroll', updateArrows, { passive: true });
  updateArrows();
}
initScrollArrows();

// ── Scratchpad ───────────────────────────────────────────────────────────
const SCRATCHPAD_KEY = 'prod_scratchpad_v1';

function loadScratchpad() {
  try { return JSON.parse(localStorage.getItem(SCRATCHPAD_KEY) || '{}'); } catch { return {}; }
}
function saveScratchpad(data) { localStorage.setItem(SCRATCHPAD_KEY, JSON.stringify(data)); }

function initScratchpad() {
  const data = loadScratchpad();
  const today = localDateStr(new Date());
  const textarea = document.getElementById('scratchpad-textarea');
  if (!textarea) return;

  // Archive previous day if needed
  if (data.date && data.date !== today && data.text) {
    if (!data.history) data.history = {};
    data.history[data.date] = data.text;
    data.text = '';
    data.date = today;
    saveScratchpad(data);
  }

  textarea.value = data.date === today ? (data.text || '') : '';

  let saveTimer = null;
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const d = loadScratchpad();
      d.text = textarea.value;
      d.date = localDateStr(new Date());
      saveScratchpad(d);
      const status = document.getElementById('scratchpad-status');
      status.textContent = 'сохранено';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }, 500);
  });
}

function scratchpadToTask() {
  const textarea = document.getElementById('scratchpad-textarea');
  const text = textarea.value.trim();
  if (!text) return;
  // Take first line as task
  const firstLine = text.split('\n')[0].slice(0, 120);
  addTask(firstLine);
  textarea.value = '';
  const d = loadScratchpad();
  d.text = '';
  d.date = localDateStr(new Date());
  saveScratchpad(d);
}

function toggleScratchpadHistory() {
  const panel = document.getElementById('scratchpad-history');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  const data = loadScratchpad();
  const history = data.history || {};
  const dates = Object.keys(history).sort().reverse();
  if (!dates.length) {
    panel.innerHTML = '<div style="color:var(--muted);font-size:13px;">Пока пусто</div>';
  } else {
    panel.innerHTML = dates.slice(0, 14).map(d => {
      const dt = new Date(d + 'T00:00:00');
      const label = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', weekday: 'short' });
      return `<div class="scratchpad-history-day">
        <div class="scratchpad-history-date">${label}</div>
        <div class="scratchpad-history-text">${escHtml(history[d])}</div>
      </div>`;
    }).join('');
  }
  panel.style.display = '';
}

initScratchpad();

// ── Distraction Log ──────────────────────────────────────────────────────
const DISTRACTION_KEY = 'prod_distractions_v1';
const DISTRACTION_CATS = [
  { id: 'youtube',   icon: '📺', label: 'YouTube' },
  { id: 'social',    icon: '📱', label: 'Соцсети' },
  { id: 'messenger', icon: '💬', label: 'Мессенджер' },
  { id: 'other',     icon: '❓', label: 'Другое' },
];

function loadDistractions() {
  try { return JSON.parse(localStorage.getItem(DISTRACTION_KEY) || '{}'); } catch { return {}; }
}
function saveDistractions(d) { localStorage.setItem(DISTRACTION_KEY, JSON.stringify(d)); }

function logDistraction(category) {
  const data = loadDistractions();
  const today = localDateStr(new Date());
  if (!data[today]) data[today] = [];
  data[today].push({ category, time: new Date().toISOString() });
  saveDistractions(data);
  renderDistractionWidget();
  toggleDistractionPanel();
}

function toggleDistractionPanel() {
  const panel = document.getElementById('distraction-panel');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  panel.innerHTML = DISTRACTION_CATS.map(c =>
    `<button class="distraction-cat-btn" onclick="logDistraction('${c.id}')">${c.icon} ${c.label}</button>`
  ).join('');
  panel.style.display = '';
}

function renderDistractionWidget() {
  const data = loadDistractions();
  const today = localDateStr(new Date());
  const todayCount = (data[today] || []).length;
  document.getElementById('stat-distraction-count').textContent = todayCount;

  // Weekly report
  const weeklyEl = document.getElementById('distraction-weekly');
  const counts = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    (data[key] || []).forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (sorted.length) {
    weeklyEl.innerHTML = 'За неделю: ' + sorted.map(([cat, n]) => {
      const c = DISTRACTION_CATS.find(x => x.id === cat);
      return `${c ? c.icon : ''} ${n}`;
    }).join(' · ');
  } else {
    weeklyEl.innerHTML = '';
  }
}

// Close distraction panel on outside click
document.addEventListener('click', e => {
  const panel = document.getElementById('distraction-panel');
  const btn = document.getElementById('distraction-log-btn');
  if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) {
    panel.style.display = 'none';
  }
});

renderDistractionWidget();

// ── Morning Briefing ─────────────────────────────────────────────────────
const BRIEFING_KEY = 'prod_briefing_dismissed';

function shouldShowBriefing() {
  const h = new Date().getHours();
  if (h < 7 || h >= 9) return false;
  return localStorage.getItem(BRIEFING_KEY) !== localDateStr(new Date());
}

function renderBriefing() {
  if (!shouldShowBriefing()) return;
  const overlay = document.getElementById('briefing-overlay');
  const card = document.getElementById('briefing-card');
  const today = localDateStr(new Date());

  // Unfinished tasks (carried from previous days)
  const tasks = loadTasks().filter(t => !t.done);
  const carriedTasks = tasks.filter(t => t.addedDate && t.addedDate < today);
  const totalTasks = tasks.length;

  // Monthly goals
  const mk = currentMonthKey();
  const goals = getGoalsForPeriod(MONTHLY_GOALS_KEY, mk);
  const goalsDone = goals.filter(g => g.done).length;
  const goalsTotal = goals.length;
  const goalsPct = goalsTotal > 0 ? Math.round(goalsDone / goalsTotal * 100) : 0;

  // Current book
  const reading = loadReading();
  const currentBook = loadReadingBooks().find(b => {
    const st = reading[b.id];
    return st && st.status === 'reading';
  });
  const bookInfo = currentBook
    ? `${currentBook.title} — стр. ${(reading[currentBook.id] || {}).page || '?'}`
    : 'нет активной книги';

  // Early start streak
  const earlyData = loadEarlyData();
  const emk = getEarlyMonthKey();
  const earlyDays = earlyData[emk] ? Object.keys(earlyData[emk]).length : 0;

  card.innerHTML = `
    <div class="briefing-title">Доброе утро!</div>
    <div class="briefing-section">
      <div class="briefing-section-title">Задачи</div>
      <div class="briefing-stat">${totalTasks} задач на сегодня</div>
      ${carriedTasks.length ? `<div class="briefing-tasks">${carriedTasks.length} перенесено с прошлых дней</div>` : ''}
    </div>
    <div class="briefing-section">
      <div class="briefing-section-title">Цели месяца</div>
      <div class="briefing-stat">${goalsPct}% <span style="color:var(--muted);font-size:13px">(${goalsDone}/${goalsTotal})</span></div>
    </div>
    <div class="briefing-section">
      <div class="briefing-section-title">Чтение</div>
      <div class="briefing-stat" style="font-size:14px">${bookInfo}</div>
    </div>
    <div class="briefing-section">
      <div class="briefing-section-title">Ранний старт</div>
      <div class="briefing-stat">${earlyDays} дней в этом месяце</div>
    </div>
    <button class="briefing-start-btn" onclick="dismissBriefing()">Начать день</button>
  `;
  overlay.style.display = '';
}

function dismissBriefing() {
  localStorage.setItem(BRIEFING_KEY, localDateStr(new Date()));
  document.getElementById('briefing-overlay').style.display = 'none';
}

renderBriefing();

// ── Weekly Retrospective ─────────────────────────────────────────────────
const RETRO_KEY = 'prod_retrospective_v1';

function getISOWeek(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1;
}

function getWeekKey() {
  const now = new Date();
  return now.getFullYear() + '-W' + String(getISOWeek(now)).padStart(2, '0');
}

function loadRetro() {
  try { return JSON.parse(localStorage.getItem(RETRO_KEY) || '{}'); } catch { return {}; }
}
function saveRetro(d) { localStorage.setItem(RETRO_KEY, JSON.stringify(d)); }

function shouldShowRetro() {
  const now = new Date();
  if (now.getDay() !== 5 || now.getHours() < 20) return false;
  const data = loadRetro();
  return !data[getWeekKey()];
}

function calcRetroStats() {
  const history = loadHistory();
  const today = new Date();
  // Get Monday of this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  monday.setHours(0, 0, 0, 0);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(localDateStr(d));
  }

  const weekHistory = history.filter(h => {
    if (!h.doneAt) return false;
    const d = localDateStr(new Date(h.doneAt));
    return weekDays.includes(d);
  });

  const byDay = {};
  weekHistory.forEach(h => {
    const d = localDateStr(new Date(h.doneAt));
    byDay[d] = (byDay[d] || 0) + 1;
  });

  const bestDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  const bestDay = bestDayEntry
    ? new Date(bestDayEntry[0] + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'long' }) + ` (${bestDayEntry[1]})`
    : '—';

  // Early starts this week
  const earlyData = loadEarlyData();
  const emk = getEarlyMonthKey();
  const earlyThisWeek = weekDays.filter(d => earlyData[emk] && earlyData[emk][d]).length;

  // Monthly goals
  const goals = getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey());
  const goalsPct = goals.length > 0 ? Math.round(goals.filter(g => g.done).length / goals.length * 100) : 0;

  // Distractions
  const distrData = loadDistractions();
  let totalDistractions = 0;
  weekDays.forEach(d => { totalDistractions += (distrData[d] || []).length; });

  return {
    tasksCompleted: weekHistory.length,
    avgPerDay: weekHistory.length > 0 ? (weekHistory.length / 7).toFixed(1) : '0',
    bestDay,
    earlyStarts: earlyThisWeek,
    goalsPct,
    distractions: totalDistractions,
  };
}

function renderRetro() {
  if (!shouldShowRetro()) return;
  const overlay = document.getElementById('retro-overlay');
  const card = document.getElementById('retro-card');
  const stats = calcRetroStats();
  const wk = getWeekKey();

  card.innerHTML = `
    <div class="retro-title">Ретроспектива — неделя ${wk.split('-W')[1]}</div>
    <div class="retro-stats-grid">
      <div class="retro-stat">
        <div class="retro-stat-value">${stats.tasksCompleted}</div>
        <div class="retro-stat-label">Задач выполнено</div>
      </div>
      <div class="retro-stat">
        <div class="retro-stat-value">${stats.avgPerDay}</div>
        <div class="retro-stat-label">Среднее / день</div>
      </div>
      <div class="retro-stat">
        <div class="retro-stat-value">${stats.earlyStarts}/7</div>
        <div class="retro-stat-label">Ранних стартов</div>
      </div>
      <div class="retro-stat">
        <div class="retro-stat-value">${stats.goalsPct}%</div>
        <div class="retro-stat-label">Цели месяца</div>
      </div>
      <div class="retro-stat">
        <div class="retro-stat-value">${stats.distractions}</div>
        <div class="retro-stat-label">Отвлечений</div>
      </div>
      <div class="retro-stat">
        <div class="retro-stat-value" style="font-size:14px">${stats.bestDay}</div>
        <div class="retro-stat-label">Лучший день</div>
      </div>
    </div>
    <div class="retro-note-label">Что сработало / что изменить:</div>
    <textarea class="retro-note" id="retro-note" placeholder="Заметки по итогам недели…" rows="3"></textarea>
    <button class="retro-dismiss-btn" onclick="dismissRetro()">Завершить ретроспективу</button>
  `;
  overlay.style.display = '';

  // Debounced save for note
  let retroTimer = null;
  document.getElementById('retro-note').addEventListener('input', e => {
    clearTimeout(retroTimer);
    retroTimer = setTimeout(() => {
      const data = loadRetro();
      if (!data[wk]) data[wk] = {};
      data[wk].note = e.target.value;
      saveRetro(data);
    }, 500);
  });
}

function dismissRetro() {
  const data = loadRetro();
  const wk = getWeekKey();
  const note = document.getElementById('retro-note');
  if (!data[wk]) data[wk] = {};
  data[wk].stats = calcRetroStats();
  data[wk].note = note ? note.value : '';
  data[wk].createdAt = new Date().toISOString();
  saveRetro(data);
  document.getElementById('retro-overlay').style.display = 'none';
}

renderRetro();
// Check for retro every minute
setInterval(() => { renderRetro(); }, 60000);

// ── Go Roadmap (Interactive) ─────────────────────────────────────────────
const GO_LESSONS_KEY = 'prod_go_lessons_v1';
const GO_TOUR_KEY = 'prod_go_tour_v1';
const GO_CODE_KEY = 'prod_go_code_v1';
const GO_START_KEY = 'prod_go_start_date';

let currentGoTab = 'lessons';
let expandedLesson = null;

function loadGoProgress(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function saveGoProgress(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

function getGoStartDate() {
  let d = localStorage.getItem(GO_START_KEY);
  if (!d) {
    d = localDateStr(new Date());
    localStorage.setItem(GO_START_KEY, d);
  }
  return d;
}

function daysSinceGoStart() {
  const start = new Date(getGoStartDate() + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - start) / 86400000);
}

function isLessonAvailable(lessonIndex) {
  return lessonIndex <= daysSinceGoStart();
}

function toggleGoLesson(lessonId) {
  const progress = loadGoProgress(GO_LESSONS_KEY);
  if (progress[lessonId]) {
    delete progress[lessonId];
  } else {
    progress[lessonId] = { done: true, doneAt: new Date().toISOString() };
  }
  saveGoProgress(GO_LESSONS_KEY, progress);
  renderGoTab();
}

function toggleGoItem(key, itemId) {
  const progress = loadGoProgress(key);
  if (progress[itemId]) {
    delete progress[itemId];
  } else {
    progress[itemId] = { done: true, doneAt: new Date().toISOString() };
  }
  saveGoProgress(key, progress);
  renderGoTab();
}

function expandGoLesson(id) {
  expandedLesson = expandedLesson === id ? null : id;
  renderGoTab();
}

function setGoTab(tab) {
  currentGoTab = tab;
  document.querySelectorAll('.go-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderGoTab();
}

function renderGoTab() {
  const container = document.getElementById('go-tab-content');
  if (!container) return;

  // Summary
  const lp = loadGoProgress(GO_LESSONS_KEY);
  const tp = loadGoProgress(GO_TOUR_KEY);
  const cp = loadGoProgress(GO_CODE_KEY);
  const totalDone = Object.keys(lp).length + Object.keys(tp).length + Object.keys(cp).length;
  const totalItems = (typeof GO_LESSONS !== 'undefined' ? GO_LESSONS.length : 0)
    + (typeof GO_TOUR_EXERCISES !== 'undefined' ? GO_TOUR_EXERCISES.length : 0)
    + (typeof GO_CODE_STUDY !== 'undefined' ? GO_CODE_STUDY.length : 0);
  const summaryEl = document.getElementById('go-progress-summary');
  if (summaryEl) summaryEl.textContent = `${totalDone} / ${totalItems} выполнено`;

  if (currentGoTab === 'lessons') renderGoLessons(container);
  else if (currentGoTab === 'tour') renderGoTour(container);
  else if (currentGoTab === 'code') renderGoCode(container);
  else if (currentGoTab === 'books') renderGoBooks(container);
}

function renderGoLessons(container) {
  if (typeof GO_LESSONS === 'undefined') { container.innerHTML = ''; return; }
  const progress = loadGoProgress(GO_LESSONS_KEY);
  const doneCnt = Object.keys(progress).length;

  let html = `<div class="go-section-progress">
    <span style="font-size:12px;color:var(--muted)">Syncthing уроки: ${doneCnt}/${GO_LESSONS.length}</span>
    <div class="go-section-progress-bar">
      <div class="go-section-progress-fill" style="width:${(doneCnt/GO_LESSONS.length*100).toFixed(0)}%;background:var(--green)"></div>
    </div>
  </div>`;

  GO_LESSONS.forEach((lesson, i) => {
    const isDone = !!progress[lesson.id];
    const available = isLessonAvailable(i);
    const isExpanded = expandedLesson === lesson.id;

    if (!available) {
      const unlockDate = new Date(getGoStartDate() + 'T00:00:00');
      unlockDate.setDate(unlockDate.getDate() + i);
      const dateStr = unlockDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      html += `<div class="go-lesson-item go-lesson-locked">
        <div class="go-lesson-header">
          <div class="go-lesson-check" style="opacity:.3">🔒</div>
          <span class="go-lesson-num">${lesson.id}.</span>
          <span class="go-lesson-title">${escHtml(lesson.title)}</span>
          <span class="go-lesson-meta">откроется ${dateStr}</span>
        </div>
      </div>`;
      return;
    }

    html += `<div class="go-lesson-item">
      <div class="go-lesson-header" onclick="expandGoLesson(${lesson.id})">
        <div class="go-lesson-check ${isDone ? 'done' : ''}" onclick="event.stopPropagation();toggleGoLesson(${lesson.id})">${isDone ? '✓' : ''}</div>
        <span class="go-lesson-num">${lesson.id}.</span>
        <span class="go-lesson-title ${isDone ? 'done' : ''}">${escHtml(lesson.title)}</span>
        <span class="go-lesson-meta"><span>${lesson.time}</span></span>
      </div>`;

    if (isExpanded) {
      html += `<div class="go-lesson-body">
        <div style="font-size:13px;color:var(--muted);margin-bottom:10px">${escHtml(lesson.goal)}</div>`;
      (lesson.steps || []).forEach((step, si) => {
        html += `<div class="go-step">
          <div class="go-step-title">Шаг ${si + 1}: ${escHtml(step.title)}</div>
          <div class="go-step-text">${escHtml(step.text)}</div>
          ${step.code ? `<div class="go-step-code">${escHtml(step.code)}</div>` : ''}
        </div>`;
      });
      if (lesson.takeaways && lesson.takeaways.length) {
        html += `<div class="go-takeaways"><strong>Что вы узнали:</strong><br>${lesson.takeaways.map(t => '• ' + escHtml(t)).join('<br>')}</div>`;
      }
      if (lesson.codeToStudy && lesson.codeToStudy.length) {
        html += `<div class="go-code-study-list"><strong>Код для изучения:</strong> ${lesson.codeToStudy.map(c => `<code>${escHtml(c)}</code>`).join(', ')}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  });
  container.innerHTML = html;
}

function renderGoTour(container) {
  if (typeof GO_TOUR_EXERCISES === 'undefined') { container.innerHTML = ''; return; }
  const progress = loadGoProgress(GO_TOUR_KEY);
  const doneCnt = Object.keys(progress).length;

  let html = `<div class="go-section-progress">
    <span style="font-size:12px;color:var(--muted)">Go Tour упражнения: ${doneCnt}/${GO_TOUR_EXERCISES.length}</span>
    <div class="go-section-progress-bar">
      <div class="go-section-progress-fill" style="width:${(doneCnt/GO_TOUR_EXERCISES.length*100).toFixed(0)}%;background:var(--blue)"></div>
    </div>
  </div>`;

  GO_TOUR_EXERCISES.forEach(ex => {
    const isDone = !!progress[ex.id];
    html += `<div class="go-tour-item" style="display:flex;align-items:center;gap:10px">
      <div class="go-lesson-check ${isDone ? 'done' : ''}" onclick="toggleGoItem('${GO_TOUR_KEY}','${ex.id}')">${isDone ? '✓' : ''}</div>
      <div style="flex:1">
        <span style="font-size:13px;font-weight:600">${escHtml(ex.title)}</span>
        <span style="font-size:12px;color:var(--muted);margin-left:6px">${escHtml(ex.desc)}</span>
      </div>
      <a class="go-tour-link" href="${ex.url}" target="_blank" rel="noopener">go.dev →</a>
    </div>`;
  });
  container.innerHTML = html;
}

function renderGoCode(container) {
  if (typeof GO_CODE_STUDY === 'undefined') { container.innerHTML = ''; return; }
  const progress = loadGoProgress(GO_CODE_KEY);
  const doneCnt = Object.keys(progress).length;

  let html = `<div class="go-section-progress">
    <span style="font-size:12px;color:var(--muted)">Изучение кода Syncthing: ${doneCnt}/${GO_CODE_STUDY.length}</span>
    <div class="go-section-progress-bar">
      <div class="go-section-progress-fill" style="width:${(doneCnt/GO_CODE_STUDY.length*100).toFixed(0)}%;background:var(--yellow)"></div>
    </div>
  </div>`;

  GO_CODE_STUDY.forEach(item => {
    const isDone = !!progress[item.id];
    html += `<div class="go-code-item" style="display:flex;align-items:center;gap:10px">
      <div class="go-lesson-check ${isDone ? 'done' : ''}" onclick="toggleGoItem('${GO_CODE_KEY}','${item.id}')">${isDone ? '✓' : ''}</div>
      <div style="flex:1">
        <code style="font-size:13px;color:var(--cyan)">${escHtml(item.title)}</code>
        <span style="font-size:12px;color:var(--muted);margin-left:6px">— ${escHtml(item.desc)}</span>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function renderGoBooks(container) {
  if (typeof GO_BOOKS === 'undefined') { container.innerHTML = ''; return; }
  let html = '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Рекомендуемые ресурсы по этапам изучения</div>';
  GO_BOOKS.forEach(book => {
    html += `<div class="go-book-item" style="display:flex;align-items:center;gap:10px">
      <span style="font-size:14px">📖</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${escHtml(book.title)}</div>
        <div class="go-book-author">${escHtml(book.author)}</div>
      </div>
      <span class="go-book-stage">${escHtml(book.stage)}</span>
    </div>`;
  });
  container.innerHTML = html;
}

// Mark lesson 1 as done (completed today)
(function() {
  const p = loadGoProgress(GO_LESSONS_KEY);
  if (!p[1]) {
    p[1] = { done: true, doneAt: new Date().toISOString() };
    saveGoProgress(GO_LESSONS_KEY, p);
  }
})();

renderGoTab();

// ── Data Export / Import ─────────────────────────────────────────────────
function exportData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard-data-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== 'object' || data === null) throw new Error('bad format');
        const count = Object.keys(data).length;
        if (!confirm(`Импортировать ${count} записей? Существующие данные с совпадающими ключами будут перезаписаны.`)) return;
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        location.reload();
      } catch {
        alert('Ошибка: файл не является корректным JSON-экспортом.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
