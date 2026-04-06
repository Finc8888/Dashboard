'use strict';

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

function loadGoalsStore(storageKey) { return loadJSON(storageKey, {}); }
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

function initGoalListeners() {
  const mAdd = document.getElementById('monthly-goal-add');
  const mInp = document.getElementById('monthly-goal-input');
  const yAdd = document.getElementById('yearly-goal-add');
  const yInp = document.getElementById('yearly-goal-input');
  if (mAdd) mAdd.addEventListener('click', () => {
    if (mInp.value.trim()) { addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), mInp.value); mInp.value = ''; renderAllGoals(); }
  });
  if (mInp) mInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) { addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), e.target.value); e.target.value = ''; renderAllGoals(); }
  });
  if (yAdd) yAdd.addEventListener('click', () => {
    if (yInp.value.trim()) { addGoal(YEARLY_GOALS_KEY, currentYearKey(), yInp.value); yInp.value = ''; renderAllGoals(); }
  });
  if (yInp) yInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) { addGoal(YEARLY_GOALS_KEY, currentYearKey(), e.target.value); e.target.value = ''; renderAllGoals(); }
  });
}

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


// ── Registration ────────────────────────────────────────────────────────
function initGoals() {
  carryOverGoals(MONTHLY_GOALS_KEY, currentMonthKey());
  carryOverGoals(YEARLY_GOALS_KEY, currentYearKey());
  initGoalListeners();
}

registerWidget({
  id: 'monthly-goals',
  render: renderAllGoals,
  init: initGoals,
});

registerWidget({
  id: 'yearly-goals',
  render: renderAllGoals,
});
