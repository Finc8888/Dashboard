'use strict';

// ── Retro History ─────────────────────────────────────────────────────
function renderRetroHistory() {
  const list = document.getElementById('retro-history-list');
  if (!list) return;
  const data = loadRetro();
  const weeks = Object.keys(data).sort().reverse();
  if (!weeks.length) {
    list.innerHTML = '<div class="retro-history-empty">Ещё нет записей</div>';
    return;
  }
  list.innerHTML = weeks.map(wk => {
    const entry = data[wk];
    const weekNum = wk.split('-W')[1];
    const year = wk.split('-W')[0];
    const note = entry.note ? escHtml(entry.note) : '<span class="retro-history-no-note">без заметки</span>';
    const stats = entry.stats;
    const statsHtml = stats ? `
      <div class="retro-history-stats">
        <span title="Задач">✅ ${stats.tasksCompleted}</span>
        <span title="Ранних стартов">🌅 ${stats.earlyStarts}/7</span>
        <span title="Цели месяца">🎯 ${stats.goalsPct}%</span>
        <span title="Отвлечений">🚫 ${stats.distractions}</span>
      </div>` : '';
    return `<div class="retro-history-item">
      <div class="retro-history-week">Неделя ${weekNum}, ${year}</div>
      ${statsHtml}
      <div class="retro-history-note">${note}</div>
    </div>`;
  }).join('');
}

function toggleRetroHistory() {
  const list = document.getElementById('retro-history-list');
  const btn = document.querySelector('.retro-history-toggle');
  if (!list || !btn) return;
  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : '';
  btn.textContent = isOpen ? 'развернуть ↓' : 'свернуть ↑';
  if (!isOpen) renderRetroHistory();
}

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
