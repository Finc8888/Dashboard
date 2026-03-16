'use strict';

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
];

const PROJECT_STATUS = {}; // id → 'checking' | 'online' | 'offline'

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
  list.innerHTML = PROJECTS.map(p => {
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

function initProjectsNav() {
  renderProjectsNav();
  PROJECTS.forEach(p => checkProject(p));
  setInterval(() => PROJECTS.forEach(p => checkProject(p)), 30000);
}

initProjectsNav();

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
const slots = [
  { time: '07:00', end: '07:30', label: 'Подъём',                   sub: 'Вода · зарядка · завтрак без телефона', dot: 'dot-muted'  },
  { time: '07:30', end: '09:30', label: '🔴 DEEP WORK #1',          sub: 'Рабочие задачи (2 часа)',               dot: 'dot-red'    },
  { time: '09:30', end: '09:45', label: 'Перерыв',                  sub: 'Прогулка — не YouTube',                 dot: 'dot-muted'  },
  { time: '09:45', end: '10:30', label: '🟡 DEEP WORK #2 — Golang', sub: '45 минут чистого Go',                  dot: 'dot-yellow' },
  { time: '10:30', end: '12:00', label: 'Рабочие задачи',           sub: 'Средний приоритет',                    dot: 'dot-red'    },
  { time: '12:00', end: '13:00', label: 'Обед',                     sub: 'Полноценный отдых — не работа',        dot: 'dot-muted'  },
  { time: '13:00', end: '15:00', label: 'Рабочие задачи',           sub: 'Код-ревью · email · Jira',             dot: 'dot-red'    },
  { time: '15:00', end: '15:15', label: 'Перерыв',                  sub: '',                                     dot: 'dot-muted'  },
  { time: '15:15', end: '16:00', label: '🟢 Go — эксперименты',     sub: 'Рефакторинг · новые концепции',        dot: 'dot-green'  },
  { time: '16:00', end: '18:30', label: 'Свободное время',          sub: 'YouTube разрешён в этом окне',         dot: 'dot-blue'   },
  { time: '18:30', end: '19:00', label: 'Подготовка к бегу',        sub: 'Лёгкий перекус',                      dot: 'dot-muted'  },
  { time: '19:00', end: '20:00', label: '🏃 Бег',                   sub: 'Вечерняя пробежка',                   dot: 'dot-cyan'   },
  { time: '20:00', end: '21:00', label: '📱 Duolingo',              sub: 'Hard mode · не пропускать',            dot: 'dot-purple' },
  { time: '21:00', end: '21:15', label: 'Планирование завтра',      sub: '10–15 минут · 3 выполненных дела',     dot: 'dot-muted'  },
  { time: '21:15', end: '22:30', label: '📖 Вечернее чтение',        sub: 'По списку · бумага или e-ink',         dot: 'dot-purple' },
  { time: '22:30', end: '23:59', label: '😴 Сон',                   sub: '',                                     dot: 'dot-muted'  },
];
const LEM_SLOT_INDEX = 14;

let lastActiveIndex = -1;

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
    sendNotification('Новый блок расписания', `${s.time} — ${s.label}${s.sub ? '\n' + s.sub : ''}`);
    if (activeIndex === LEM_SLOT_INDEX) notifyTaskSummary();
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
      <div>
        <div class="slot-label">${slot.label}</div>
        ${slot.sub ? `<div class="slot-sub">${slot.sub}</div>` : ''}
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
  if (document.getElementById('history-panel').classList.contains('open')) renderHistory();
}

function deleteTask(id) {
  saveTasks(loadTasks().filter(t => t.id !== id));
  renderTodo();
}

function setCurrentTask(id) {
  const tasks = loadTasks();
  const clickedTask = tasks.find(t => t.id === id);
  const isCurrentlyActive = clickedTask && clickedTask.current;
  tasks.forEach(t => { t.current = false; });
  if (!isCurrentlyActive) {
    const t = tasks.find(t => t.id === id);
    if (t) t.current = true;
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

// ── 30-day Goals ──────────────────────────────────────────────────────────
const GOALS_KEY = 'prod_goals_v1';
const goalsData = [
  { id: 'tour',    icon: '🟦', text: 'Пройти Tour of Go полностью' },
  { id: 'scripts', icon: '📗', text: 'Написать 30 маленьких скриптов на Go (1 в день)' },
  { id: 'tasks',   icon: '🔴', text: 'Закрыть 10 накопившихся рабочих задач' },
  { id: 'duo',     icon: '📱', text: 'Не пропустить Duolingo более 2 раз' },
  { id: 'blocker', icon: '📵', text: 'Установить блокировщик YouTube/новостей в первый же день' },
  { id: 'lem',     icon: '📖', text: 'Прочитать первые две книги списка (Тед Чан)' },
  { id: 'journal', icon: '📓', text: 'Вести трекинг хотя бы 20 из 30 дней' },
];

function loadChecked()  { try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '{}'); } catch { return {}; } }
function saveChecked(c) { localStorage.setItem(GOALS_KEY, JSON.stringify(c)); }

function renderGoals() {
  const checked   = loadChecked();
  const container = document.getElementById('goals');
  container.innerHTML = '';
  goalsData.forEach(g => {
    const el = document.createElement('div');
    el.className = 'goal' + (checked[g.id] ? ' checked' : '');
    el.innerHTML = `
      <div class="checkbox">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="goal-icon">${g.icon}</span>
      <span class="goal-text">${g.text}</span>`;
    el.addEventListener('click', () => {
      const c = loadChecked();
      c[g.id] = !c[g.id];
      saveChecked(c);
      renderGoals();
    });
    container.appendChild(el);
  });
}
renderGoals();

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
animateStat('stat-journal', getStat('journal'));

const statMeta = {
  'stat-go':      { key: 'go',      max: 30 },
  'stat-tasks':   { key: 'tasks',   max: 10 },
  'stat-duo':     { key: 'duo',     max: 2  },
  'stat-journal': { key: 'journal', max: 20 },
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

const BOOKS = [
  { id: 'chan-1', num: 1, title: 'История твоей жизни', author: 'Тед Чан', type: 'сборник', subItems: [
    { id: 'chan-1-s1', title: 'Вавилонская башня' },
    { id: 'chan-1-s2', title: 'Понимай' },
    { id: 'chan-1-s3', title: 'Деление на ноль' },
    { id: 'chan-1-s4', title: 'История твоей жизни' },
    { id: 'chan-1-s5', title: 'Семьдесят две буквы' },
    { id: 'chan-1-s6', title: 'Эволюция человеческой науки' },
    { id: 'chan-1-s7', title: 'Ад — это отсутствие Бога' },
    { id: 'chan-1-s8', title: 'Тебе нравится, что ты видишь?' },
  ]},
  { id: 'chan-2', num: 2, title: 'Выдох', author: 'Тед Чан', type: 'сборник', subItems: [
    { id: 'chan-2-s1', title: 'Купец и волшебные врата' },
    { id: 'chan-2-s2', title: 'Выдох' },
    { id: 'chan-2-s3', title: 'Чего от нас ждут' },
    { id: 'chan-2-s4', title: 'Жизненный цикл программных объектов' },
    { id: 'chan-2-s5', title: 'Дейси, переменная' },
    { id: 'chan-2-s6', title: 'Истина факта, истина чувства' },
    { id: 'chan-2-s7', title: 'Великое молчание' },
    { id: 'chan-2-s8', title: 'Ома' },
    { id: 'chan-2-s9', title: 'Тревога — это головокружение свободы' },
  ]},
  { id: 'leguin-1',        num: 3,  title: 'Обездоленный',        author: 'Урсула Ле Гуин',        type: 'роман'     },
  { id: 'leguin-2',        num: 4,  title: 'Левая рука тьмы',     author: 'Урсула Ле Гуин',        type: 'роман'     },
  { id: 'leguin-3', num: 5, title: 'Волшебник Земноморья', author: 'Урсула Ле Гуин', type: 'трилогия', subItems: [
    { id: 'leguin-3-s1', title: 'Волшебник Земноморья' },
    { id: 'leguin-3-s2', title: 'Гробницы Атуана' },
    { id: 'leguin-3-s3', title: 'На последнем берегу' },
  ]},
  { id: 'lem-1', num: 6, title: 'Кибериада', author: 'Станислав Лем', type: 'сборник', subItems: [
    { id: 'lem-1-s1', title: 'Как уцелела Вселенная' },
    { id: 'lem-1-s2', title: 'Три электрорыцаря' },
    { id: 'lem-1-s3', title: 'Путешествие первое' },
    { id: 'lem-1-s4', title: 'Путешествие второе' },
    { id: 'lem-1-s5', title: 'Путешествие третье' },
    { id: 'lem-1-s6', title: 'Путешествие четвёртое' },
    { id: 'lem-1-s7', title: 'Путешествие пятое' },
    { id: 'lem-1-s8', title: 'Путешествие шестое' },
    { id: 'lem-1-s9', title: 'Путешествие седьмое' },
    { id: 'lem-1-s10', title: 'Альтруизин' },
  ]},
  { id: 'lem-2',           num: 7,  title: 'Непобедимый',         author: 'Станислав Лем',         type: 'роман'     },
  { id: 'hofstadter',      num: 8,  title: 'Гёдель, Эшер, Бах',  author: 'Дуглас Хофштадтер',    type: 'нон-фикшн' },
  { id: 'csikszentmihalyi',num: 9,  title: 'Поток',               author: 'Михай Чиксентмихайи',  type: 'нон-фикшн' },
  { id: 'lem-3',           num: 10, title: 'Солярис',             author: 'Станислав Лем',         type: 'роман'     },
];

function loadReading() {
  try { return JSON.parse(localStorage.getItem(READING_KEY) || '{}'); } catch { return {}; }
}
function saveReading(data) { localStorage.setItem(READING_KEY, JSON.stringify(data)); }

function getBookState(data, id) {
  return data[id] || { status: 'waiting', page: 0, startedAt: null };
}

// Track which books are expanded
const expandedBooks = {};

function toggleBookExpand(id) {
  expandedBooks[id] = !expandedBooks[id];
  renderReadingList();
}

function syncParentFromSubs(data, book) {
  if (!book.subItems) return;
  const allDone = book.subItems.every(s => getBookState(data, s.id).status === 'done');
  const anyStarted = book.subItems.some(s => getBookState(data, s.id).status !== 'waiting');
  const parentState = getBookState(data, book.id);
  if (allDone) {
    data[book.id] = { ...parentState, status: 'done' };
  } else if (anyStarted && parentState.status === 'done') {
    data[book.id] = { ...parentState, status: 'reading', startedAt: parentState.startedAt || todayStr() };
  }
}

function syncSubsFromParent(data, book, newStatus) {
  if (!book.subItems) return;
  if (newStatus === 'done') {
    book.subItems.forEach(s => {
      data[s.id] = { ...getBookState(data, s.id), status: 'done' };
    });
  } else if (newStatus === 'waiting') {
    book.subItems.forEach(s => {
      data[s.id] = { ...getBookState(data, s.id), status: 'waiting' };
    });
  }
}

function toggleSubItemStatus(bookId, subId) {
  const data = loadReading();
  const state = getBookState(data, subId);
  const next = state.status === 'done' ? 'waiting' : 'done';
  data[subId] = { ...state, status: next };
  const book = BOOKS.find(b => b.id === bookId);
  if (book) syncParentFromSubs(data, book);
  saveReading(data);
  renderReadingList();
}

function cycleBookStatus(id) {
  const data  = loadReading();
  const state = getBookState(data, id);
  const order = ['waiting', 'reading', 'done'];
  const next  = order[(order.indexOf(state.status) + 1) % order.length];

  // only one book "reading" at a time: if switching to reading, demote previous
  if (next === 'reading') {
    BOOKS.forEach(b => {
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

  const book = BOOKS.find(b => b.id === id);
  if (book) syncSubsFromParent(data, book, next);

  saveReading(data);
  renderReadingList();
}

function updateBookPage(id, value) {
  const data  = loadReading();
  const state = getBookState(data, id);
  const page  = Math.max(0, parseInt(value, 10) || 0);
  data[id] = { ...state, page };
  saveReading(data);
  // re-render only the page label, not the whole list (avoids losing focus)
  const label = document.getElementById('book-page-since-' + id);
  if (label && state.startedAt) label.textContent = `с ${state.startedAt}`;
}

const STATUS_ICON = { waiting: '⬜', reading: '🔄', done: '✅' };

function renderReadingList() {
  const data      = loadReading();
  const doneCount = BOOKS.filter(b => getBookState(data, b.id).status === 'done').length;
  const pct       = Math.round((doneCount / BOOKS.length) * 100);

  document.getElementById('reading-done-count').textContent = doneCount;
  document.getElementById('reading-progress-fill').style.width = pct + '%';

  const container = document.getElementById('reading-books');
  container.innerHTML = '';

  BOOKS.forEach(book => {
    const state   = getBookState(data, book.id);
    const { status, page, startedAt } = state;
    const hasSubs = book.subItems && book.subItems.length > 0;
    const isExpanded = expandedBooks[book.id];

    const el = document.createElement('div');
    el.className = 'book-item book-' + status;

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

    el.innerHTML = `
      <button class="book-status-btn" onclick="cycleBookStatus('${book.id}')" title="Изменить статус">
        ${STATUS_ICON[status]}
      </button>
      <div class="book-body">
        <div class="book-main-row">
          <span class="book-num">${book.num}.</span>
          <span class="book-title">${book.title}</span>
          <span class="book-type">${book.type}</span>
          ${subsCounter}
          ${expandBtn}
        </div>
        <div class="book-author">${book.author}</div>
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
}

renderReadingList();

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
