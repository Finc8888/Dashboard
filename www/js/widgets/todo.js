'use strict';

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
  input.maxLength = 480;
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

    // Click on text → copy to clipboard
    el.querySelector('.todo-text').addEventListener('click', () => {
      navigator.clipboard.writeText(task.text).then(() => {
        showToast('Скопировано', el.closest('.todo-card'));
      });
    });

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

function initTodoListeners() {
  const addBtn = document.getElementById('todo-add-btn');
  const input = document.getElementById('todo-input');
  if (addBtn) addBtn.addEventListener('click', () => {
    if (input.value.trim()) { addTask(input.value); input.value = ''; }
  });
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) { addTask(e.target.value); e.target.value = ''; }
  });
}

function toggleStickerFullscreen() {
  const card = document.querySelector('.sticker-card');
  const btn  = document.getElementById('sticker-expand-btn');
  const isFs = card.classList.toggle('sticker-fullscreen');
  btn.textContent = isFs ? '⤡' : '⤢';
  btn.title = isFs ? 'Свернуть' : 'Развернуть';
}

// ── History ───────────────────────────────────────────────────────────────
function toggleTodoFullscreen() {
  const card = document.querySelector('.todo-card');
  const btn  = document.getElementById('todo-expand-btn');
  const isFs = card.classList.toggle('todo-fullscreen');
  btn.textContent = isFs ? '⤡' : '⤢';
  btn.title = isFs ? 'Свернуть' : 'Развернуть';
}

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


// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'todo',
  render: renderTodo,
  init: initTodoListeners,
});
