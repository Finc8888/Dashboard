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

// ── Days counter ──────────────────────────────────────────────────────────
(function initDaysCounter() {
  const start = new Date(new Date().getFullYear(), 2, 9); // 9 марта текущего года
  const days  = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  document.getElementById('days-counter').textContent = days;
  document.getElementById('days-since-label').textContent = `с 9 марта ${start.getFullYear()}`;
})();

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
const TASKS_KEY   = 'prod_tasks_v1';
const HISTORY_KEY = 'prod_history_v1';

function loadTasks()    { try { return JSON.parse(localStorage.getItem(TASKS_KEY)   || '[]'); } catch { return []; } }
function saveTasks(t)   { localStorage.setItem(TASKS_KEY,   JSON.stringify(t)); }
function loadHistory()  { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

function addTask(text) {
  const tasks = loadTasks();
  tasks.push({ id: uid(), text: text.trim(), addedAt: new Date().toISOString(), addedDate: todayStr(), done: false, doneAt: null });
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
    el.className = 'todo-item' + (task.done ? ' done' : '');
    el.innerHTML = `
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
      <button class="todo-del" onclick="deleteTask('${task.id}')" title="Удалить">×</button>`;
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
  quoteIndex    = (quoteIndex + 1) % allQuotes.length;
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

fetch('/quotes.json')
  .then(r => { if (!r.ok) throw new Error(); return r.json(); })
  .then(data => {
    if (!Array.isArray(data) || !data.length) return;
    allQuotes     = data;
    quoteIndex    = new Date().getHours() % allQuotes.length;
    quoteChangeAt = Date.now() + QUOTE_INTERVAL;
    showQuote(allQuotes[quoteIndex]);
    setInterval(updateCountdown, 1000);
    updateCountdown();
  })
  .catch(() => {});

// ── Reading List ───────────────────────────────────────────────────────
const READING_KEY = 'prod_reading_v1';

const BOOKS = [
  { id: 'chan-1',          num: 1,  title: 'История твоей жизни', author: 'Тед Чан',               type: 'сборник'   },
  { id: 'chan-2',          num: 2,  title: 'Выдох',               author: 'Тед Чан',               type: 'сборник'   },
  { id: 'leguin-1',        num: 3,  title: 'Обездоленный',        author: 'Урсула Ле Гуин',        type: 'роман'     },
  { id: 'leguin-2',        num: 4,  title: 'Левая рука тьмы',     author: 'Урсула Ле Гуин',        type: 'роман'     },
  { id: 'leguin-3',        num: 5,  title: 'Волшебник Земноморья',author: 'Урсула Ле Гуин',        type: 'трилогия'  },
  { id: 'lem-1',           num: 6,  title: 'Кибериада',           author: 'Станислав Лем',         type: 'сборник'   },
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

    el.innerHTML = `
      <button class="book-status-btn" onclick="cycleBookStatus('${book.id}')" title="Изменить статус">
        ${STATUS_ICON[status]}
      </button>
      <div class="book-body">
        <div class="book-main-row">
          <span class="book-num">${book.num}.</span>
          <span class="book-title">${book.title}</span>
          <span class="book-type">${book.type}</span>
        </div>
        <div class="book-author">${book.author}</div>
        ${pageRow}
      </div>`;

    container.appendChild(el);
  });
}

renderReadingList();
