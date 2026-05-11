'use strict';

// ── Target Widget ───────────────────────────────────────────────────────────
const TARGETS_KEY = 'prod_targets_v1';
const TARGET_STEPS_KEY = 'prod_target_steps_v1';

function loadTargets() { return loadJSON(TARGETS_KEY, []); }
function saveTargets(targets) { localStorage.setItem(TARGETS_KEY, JSON.stringify(targets)); }

function loadTargetSteps() { return loadJSON(TARGET_STEPS_KEY, {}); }
function saveTargetSteps(steps) { localStorage.setItem(TARGET_STEPS_KEY, JSON.stringify(steps)); }

let _targetEditMode = false;
const expandedTargets = {};

function toggleTargetExpand(id) {
  expandedTargets[id] = !expandedTargets[id];
  renderTargets();
}

function toggleTargetEditMode() {
  _targetEditMode = !_targetEditMode;
  renderTargets();
}

// ── Target CRUD ─────────────────────────────────────────────────────────────
function targetAdd() {
  const titleEl = document.getElementById('target-add-title');
  if (!titleEl) return;
  const title = titleEl.value.trim();
  if (!title) return;

  const targets = loadTargets();
  const id = 'target-' + Date.now();
  targets.push({ id, title, createdAt: todayStr() });
  saveTargets(targets);
  saveTargetSteps({ ...loadTargetSteps(), [id]: [] });
  titleEl.value = '';
  renderTargets();
}

function targetRemove(id) {
  if (!confirm('Удалить цель и все её шаги?')) return;
  let targets = loadTargets();
  targets = targets.filter(t => t.id !== id);
  saveTargets(targets);
  const steps = loadTargetSteps();
  delete steps[id];
  saveTargetSteps(steps);
  renderTargets();
}

function targetMove(id, dir) {
  const targets = loadTargets();
  const idx = targets.findIndex(t => t.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= targets.length) return;
  [targets[idx], targets[newIdx]] = [targets[newIdx], targets[idx]];
  saveTargets(targets);
  renderTargets();
}

function targetStartEdit(id) {
  const targets = loadTargets();
  const target = targets.find(t => t.id === id);
  if (!target) return;
  const el = document.getElementById('target-row-' + id);
  if (!el) return;
  el.innerHTML = `
    <div class="target-edit-form">
      <input class="target-edit-input" id="edit-target-title-${id}" value="${escHtml(target.title)}" placeholder="Название цели" />
      <button class="target-edit-save" onclick="targetSaveEdit('${id}')">OK</button>
      <button class="target-edit-cancel" onclick="renderTargets()">✕</button>
    </div>`;
}

function targetSaveEdit(id) {
  const targets = loadTargets();
  const target = targets.find(t => t.id === id);
  if (!target) return;
  const title = document.getElementById('edit-target-title-' + id).value.trim();
  if (!title) return;
  target.title = title;
  saveTargets(targets);
  renderTargets();
}

function targetClearAll() {
  if (!confirm('Очистить все цели и шаги?')) return;
  saveTargets([]);
  saveTargetSteps({});
  renderTargets();
}

// ── Step CRUD ─────────────────────────────────────────────────────────────
function targetAddStep(targetId) {
  const inputEl = document.getElementById('step-add-input-' + targetId);
  if (!inputEl) return;
  const title = inputEl.value.trim();
  if (!title) return;

  const steps = loadTargetSteps();
  if (!steps[targetId]) steps[targetId] = [];
  const id = 'step-' + Date.now();
  steps[targetId].push({ id, title, done: false, createdAt: todayStr() });
  saveTargetSteps(steps);
  renderTargets();
}

function targetRemoveStep(targetId, stepId) {
  const steps = loadTargetSteps();
  if (!steps[targetId]) return;
  steps[targetId] = steps[targetId].filter(s => s.id !== stepId);
  saveTargetSteps(steps);
  targetCheckCompletion(targetId);
  renderTargets();
}

function targetMoveStep(targetId, stepId, dir) {
  const steps = loadTargetSteps();
  if (!steps[targetId]) return;
  const idx = steps[targetId].findIndex(s => s.id === stepId);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= steps[targetId].length) return;
  [steps[targetId][idx], steps[targetId][newIdx]] = [steps[targetId][newIdx], steps[targetId][idx]];
  saveTargetSteps(steps);
  renderTargets();
}

function targetStartEditStep(targetId, stepId) {
  const steps = loadTargetSteps();
  if (!steps[targetId]) return;
  const step = steps[targetId].find(s => s.id === stepId);
  if (!step) return;
  const el = document.getElementById('step-row-' + stepId);
  if (!el) return;
  el.innerHTML = `
    <div class="step-edit-form">
      <input class="step-edit-input" id="edit-step-title-${stepId}" value="${escHtml(step.title)}" placeholder="Шаг" />
      <button class="step-edit-save" onclick="targetSaveEditStep('${targetId}', '${stepId}')">OK</button>
      <button class="step-edit-cancel" onclick="renderTargets()">✕</button>
    </div>`;
}

function targetSaveEditStep(targetId, stepId) {
  const steps = loadTargetSteps();
  if (!steps[targetId]) return;
  const step = steps[targetId].find(s => s.id === stepId);
  if (!step) return;
  const title = document.getElementById('edit-step-title-' + stepId).value.trim();
  if (!title) return;
  step.title = title;
  saveTargetSteps(steps);
  renderTargets();
}

function targetToggleStep(targetId, stepId) {
  const steps = loadTargetSteps();
  if (!steps[targetId]) return;
  const step = steps[targetId].find(s => s.id === stepId);
  if (!step) return;
  step.done = !step.done;
  saveTargetSteps(steps);
  targetCheckCompletion(targetId);
  renderTargets();
}

function targetCheckCompletion(targetId) {
  const steps = loadTargetSteps();
  if (!steps[targetId]) return;
  const allDone = steps[targetId].length > 0 && steps[targetId].every(s => s.done);
  if (allDone) {
    targetTriggerCelebration(targetId);
  }
}

// ── Celebration Animation ─────────────────────────────────────────────────
function targetTriggerCelebration(targetId) {
  const targets = loadTargets();
  const target = targets.find(t => t.id === targetId);
  if (!target) return;

  const overlay = document.createElement('div');
  overlay.className = 'target-celebration-overlay';
  overlay.innerHTML = `
    <div class="target-celebration-content">
      <div class="target-celebration-icon">🎯</div>
      <div class="target-celebration-title">Цель достигнута!</div>
      <div class="target-celebration-name">${escHtml(target.title)}</div>
      <div class="target-celebration-sub">Все шаги выполнены</div>
      <button class="target-celebration-close" onclick="this.closest('.target-celebration-overlay').remove()">✕</button>
    </div>
    <div class="target-celebration-particles">
      ${Array.from({ length: 20 }, (_, i) => `<div class="target-particle" style="--i: ${i}; --x: ${(Math.random() - 0.5) * 200}px; --y: ${(Math.random() - 0.5) * 200}px;"></div>`).join('')}
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    if (overlay.parentElement) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 4000);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ── Render ────────────────────────────────────────────────────────────────
function renderTargets() {
  const targets = loadTargets();
  const allSteps = loadTargetSteps();

  const totalTargets = targets.length;
  const completedTargets = targets.filter(t => {
    const steps = allSteps[t.id] || [];
    return steps.length > 0 && steps.every(s => s.done);
  }).length;
  const pct = totalTargets > 0 ? Math.round((completedTargets / totalTargets) * 100) : 0;

  const totalCountEl = document.getElementById('target-total-count');
  const doneCountEl = document.getElementById('target-done-count');
  const progressFillEl = document.getElementById('target-progress-fill');
  const container = document.getElementById('target-list-container');

  if (totalCountEl) totalCountEl.textContent = totalTargets;
  if (doneCountEl) doneCountEl.textContent = completedTargets;
  if (progressFillEl) progressFillEl.style.width = pct + '%';

  if (!container) return;
  container.innerHTML = '';

  if (totalTargets === 0) {
    container.innerHTML = '<div class="target-empty">Нет целей. Добавьте первую цель для отслеживания.</div>';
  }

  targets.forEach((target, idx) => {
    const steps = allSteps[target.id] || [];
    const isExpanded = expandedTargets[target.id];
    const stepsDone = steps.filter(s => s.done).length;
    const allDone = steps.length > 0 && steps.every(s => s.done);

    const row = document.createElement('div');
    row.className = 'target-item' + (allDone ? ' target-done' : '');
    row.id = 'target-row-' + target.id;

    const editBtns = _targetEditMode ? `
      <div class="target-edit-actions">
        <button class="target-move-btn" onclick="targetMove('${target.id}', -1)" title="Вверх" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="target-move-btn" onclick="targetMove('${target.id}', 1)" title="Вниз" ${idx === targets.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="target-edit-btn" onclick="targetStartEdit('${target.id}')" title="Редактировать">✎</button>
        <button class="target-remove-btn" onclick="targetRemove('${target.id}')" title="Удалить">✕</button>
      </div>` : '';

    const progressPct = steps.length > 0 ? Math.round((stepsDone / steps.length) * 100) : 0;
    const progressBar = steps.length > 0 ? `
      <div class="target-step-progress-bar">
        <div class="target-step-progress-fill" style="width: ${progressPct}%"></div>
      </div>` : '';

    row.innerHTML = `
      <button class="target-expand-btn${isExpanded ? ' expanded' : ''}" onclick="toggleTargetExpand('${target.id}')" title="Раскрыть шаги">▸</button>
      <div class="target-body">
        <div class="target-main-row">
          <span class="target-num">${idx + 1}.</span>
          <span class="target-title">${escHtml(target.title)}</span>
          <span class="target-steps-counter">${stepsDone}/${steps.length}</span>
          ${editBtns}
        </div>
        <div class="target-created">Создана: ${target.createdAt}</div>
        ${progressBar}
      </div>`;

    container.appendChild(row);

    if (isExpanded) {
      const stepsList = document.createElement('div');
      stepsList.className = 'target-steps-list';
      steps.forEach((step, stepIdx) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'target-step-item' + (step.done ? ' step-done' : '');
        stepEl.id = 'step-row-' + step.id;

        const stepEditBtns = _targetEditMode ? `
          <div class="step-edit-actions">
            <button class="step-move-btn" onclick="targetMoveStep('${target.id}', '${step.id}', -1)" title="Вверх" ${stepIdx === 0 ? 'disabled' : ''}>▲</button>
            <button class="step-move-btn" onclick="targetMoveStep('${target.id}', '${step.id}', 1)" title="Вниз" ${stepIdx === steps.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="step-edit-btn" onclick="targetStartEditStep('${target.id}', '${step.id}')" title="Редактировать">✎</button>
            <button class="step-remove-btn" onclick="targetRemoveStep('${target.id}', '${step.id}')" title="Удалить">✕</button>
          </div>` : '';

        stepEl.innerHTML = `
          <button class="step-checkbox${step.done ? ' checked' : ''}" onclick="targetToggleStep('${target.id}', '${step.id}')" title="Отметить шаг">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="step-title">${escHtml(step.title)}</span>
          ${stepEditBtns}`;

        stepsList.appendChild(stepEl);
      });

      const addForm = document.createElement('div');
      addForm.className = 'target-step-add-form';
      addForm.innerHTML = `
        <input class="target-step-add-input" id="step-add-input-${target.id}" placeholder="Добавить шаг…" />
        <button class="target-step-add-btn" onclick="targetAddStep('${target.id}')" title="Добавить шаг">+</button>`;
      stepsList.appendChild(addForm);

      setTimeout(() => {
        const inp = document.getElementById('step-add-input-' + target.id);
        if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') targetAddStep(target.id); });
      }, 0);

      container.appendChild(stepsList);
    }
  });

  const addForm = document.createElement('div');
  addForm.className = 'target-add-form';
  addForm.innerHTML = `
    <input class="target-add-input" id="target-add-title" placeholder="Новая цель…" maxlength="200" />
    <button class="target-add-btn" onclick="targetAdd()" title="Добавить цель">+</button>`;
  container.appendChild(addForm);

  setTimeout(() => {
    const inp = document.getElementById('target-add-title');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') targetAdd(); });
  }, 0);
}

// ── Registration ──────────────────────────────────────────────────────────
registerWidget({
  id: 'target',
  render: renderTargets,
});
