'use strict';

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

const statMeta = {
  'stat-go':      { key: 'go',      max: 30 },
  'stat-tasks':   { key: 'tasks',   max: 10 },
  'stat-duo':     { key: 'duo',     max: 2  },
};

function initStatCounters() {
  animateStat('stat-go',      getStat('go'));
  animateStat('stat-tasks',   getStat('tasks'));
  animateStat('stat-duo',     getStat('duo'));

  Object.entries(statMeta).forEach(([id, { key, max }]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.parentElement.style.cursor = 'pointer';
    el.parentElement.title = 'Клик — +1, Shift+Клик — −1';
    el.parentElement.addEventListener('click', e => {
      let val = getStat(key);
      val = e.shiftKey ? Math.max(0, val - 1) : Math.min(max, val + 1);
      localStorage.setItem('prod_stat_' + key, val);
      el.textContent = val;
    });
  });
}

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
function patchCarryOver() {
  const origCarry = carryOverGoals;
  carryOverGoals = function(storageKey, currentKey) {
    origCarry(storageKey, currentKey);
    if (storageKey === MONTHLY_GOALS_KEY) ensureEarlyGoal();
  };
}

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

// ── Render & Init wrappers ──────────────────────────────────────────────
function renderStats() {
  renderEarlyStat();
  renderDistractionWidget();
}

function initStats() {
  initStatCounters();
  patchCarryOver();
  ensureEarlyGoal();
  checkEarlyLogin();
  setInterval(() => { checkEarlyLogin(); renderEarlyStat(); }, 60000);
  // Close distraction panel on outside click
  document.addEventListener('click', e => {
    const panel = document.getElementById('distraction-panel');
    const btn = document.getElementById('distraction-log-btn');
    if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) {
      panel.style.display = 'none';
    }
  });
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'stats',
  render: renderStats,
  init: initStats,
});
