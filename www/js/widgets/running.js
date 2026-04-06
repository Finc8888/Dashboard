'use strict';

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

function initRunning() {
  initTrainingData().then(() => {
    renderTrainingToday();
  });
}

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


// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'running',
  render: renderRunning,
  init: initRunning,
});
