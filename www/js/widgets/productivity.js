'use strict';

// ── Productivity Stats ───────────────────────────────────────────────────
const PROD_DAILY_KEY = 'prod_daily_snapshot_v1';
const MAX_TASK_IN_DAY = 10;
let currentProdPeriod = 'week';

function loadDailySnapshots() { return loadJSON(PROD_DAILY_KEY, {}); }
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

function initProductivity() {
  window.addEventListener('resize', () => renderProdChart());
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'productivity',
  render: renderProdStats,
  init: initProductivity,
});
