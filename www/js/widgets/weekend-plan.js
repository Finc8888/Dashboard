'use strict';

// ── Weekend Plan (План выходного дня) ─────────────────────────────────
const WP_TASKS_KEY = 'prod_weekend_tasks_v1';
let wpDragSrcId = null;

function loadWpTasks()  { try { return JSON.parse(localStorage.getItem(WP_TASKS_KEY) || '[]'); } catch { return []; } }
function saveWpTasks(t) { localStorage.setItem(WP_TASKS_KEY, JSON.stringify(t)); }

function addWpTask(text) {
  const tasks = loadWpTasks();
  tasks.push({ id: uid(), text: text.trim(), done: false });
  saveWpTasks(tasks);
  renderWeekendPlan();
}

function toggleWpTask(id) {
  const tasks = loadWpTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveWpTasks(tasks);
  renderWeekendPlan();
}

function deleteWpTask(id) {
  saveWpTasks(loadWpTasks().filter(t => t.id !== id));
  renderWeekendPlan();
}

function startRenameWpTask(id) {
  const itemEl = document.querySelector(`.wp-item[data-wp-id="${id}"]`);
  if (!itemEl) return;
  const textEl = itemEl.querySelector('.wp-text');
  if (!textEl) return;
  const task = loadWpTasks().find(t => t.id === id);
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
      const tasks = loadWpTasks();
      const idx = tasks.findIndex(t => t.id === id);
      if (idx !== -1) { tasks[idx].text = newText; saveWpTasks(tasks); }
    }
    renderWeekendPlan();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { saved = true; renderWeekendPlan(); }
  });
  input.addEventListener('blur', save);
}

function renderWeekendPlan() {
  const list = document.getElementById('wp-list');
  if (!list) return;

  const tasks = loadWpTasks();
  const doneCount = tasks.filter(t => t.done).length;
  const doneEl = document.getElementById('wp-done-count');
  const totalEl = document.getElementById('wp-total-count');
  if (doneEl) doneEl.textContent = doneCount;
  if (totalEl) totalEl.textContent = tasks.length;

  list.innerHTML = '';

  if (!tasks.length) {
    list.innerHTML = `<div class="todo-empty">Планов пока нет — отдыхай или добавь что-нибудь</div>`;
    return;
  }

  tasks.forEach(task => {
    const el = document.createElement('div');
    el.className = 'wp-item' + (task.done ? ' done' : '');
    el.setAttribute('draggable', 'true');
    el.dataset.wpId = task.id;

    el.innerHTML = `
      <div class="drag-handle" title="Перетащить">⠿</div>
      <div class="wp-checkbox" onclick="toggleWpTask('${task.id}')">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="wp-text">${escHtml(task.text)}</div>
      <div class="todo-actions">
        <button class="todo-rename-btn" onclick="startRenameWpTask('${task.id}')" title="Переименовать">✎</button>
        <button class="todo-del" onclick="deleteWpTask('${task.id}')" title="Удалить">×</button>
      </div>`;

    el.addEventListener('dragstart', e => {
      wpDragSrcId = task.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.wp-item.drag-over').forEach(i => i.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (wpDragSrcId !== task.id) {
        document.querySelectorAll('.wp-item.drag-over').forEach(i => i.classList.remove('drag-over'));
        el.classList.add('drag-over');
      }
    });
    el.addEventListener('dragleave', e => {
      if (e.target === el || el.contains(e.relatedTarget) === false) el.classList.remove('drag-over');
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
      if (wpDragSrcId === task.id) return;
      const tasks2 = loadWpTasks();
      const srcIdx = tasks2.findIndex(t => t.id === wpDragSrcId);
      const dstIdx = tasks2.findIndex(t => t.id === task.id);
      if (srcIdx === -1 || dstIdx === -1) return;
      const [moved] = tasks2.splice(srcIdx, 1);
      tasks2.splice(dstIdx, 0, moved);
      saveWpTasks(tasks2);
      renderWeekendPlan();
    });

    list.appendChild(el);
  });
}

function initWeekendPlanListeners() {
  const addBtn = document.getElementById('wp-add-btn');
  const input = document.getElementById('wp-input');
  if (addBtn) addBtn.addEventListener('click', () => {
    if (input.value.trim()) { addWpTask(input.value); input.value = ''; }
  });
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) { addWpTask(e.target.value); e.target.value = ''; }
  });
}

function toggleWpFullscreen() {
  const card = document.querySelector('.wp-card');
  const btn  = document.getElementById('wp-expand-btn');
  const isFs = card.classList.toggle('wp-fullscreen');
  btn.textContent = isFs ? '⤡' : '⤢';
  btn.title = isFs ? 'Свернуть' : 'Развернуть';
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'weekend-plan',
  render: renderWeekendPlan,
  init: initWeekendPlanListeners,
});
