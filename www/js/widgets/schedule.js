'use strict';

// ── Schedule ──────────────────────────────────────────────────────────────
const SCHEDULE_LABELS_KEY = 'prod_schedule_labels_v1';

const slots = [
  { time: '07:00', end: '07:30', dot: 'dot-muted'  },
  { time: '07:30', end: '09:30', dot: 'dot-red'    },
  { time: '09:30', end: '09:45', dot: 'dot-muted'  },
  { time: '09:45', end: '10:30', dot: 'dot-yellow' },
  { time: '10:30', end: '12:00', dot: 'dot-red'    },
  { time: '12:00', end: '13:00', dot: 'dot-muted'  },
  { time: '13:00', end: '15:00', dot: 'dot-red'    },
  { time: '15:00', end: '15:15', dot: 'dot-muted'  },
  { time: '15:15', end: '16:00', dot: 'dot-green'  },
  { time: '16:00', end: '18:30', dot: 'dot-blue'   },
  { time: '18:30', end: '19:00', dot: 'dot-muted'  },
  { time: '19:00', end: '20:00', dot: 'dot-cyan'   },
  { time: '20:00', end: '21:00', dot: 'dot-purple' },
  { time: '21:00', end: '21:15', dot: 'dot-muted'  },
  { time: '21:15', end: '22:30', dot: 'dot-purple' },
  { time: '22:30', end: '23:59', dot: 'dot-muted'  },
];
const READING_SLOT_INDEX = 14;

function loadScheduleLabels() { return loadJSON(SCHEDULE_LABELS_KEY, null); }
function saveScheduleLabels(labels) { localStorage.setItem(SCHEDULE_LABELS_KEY, JSON.stringify(labels)); }

function getSlotLabel(index) {
  const labels = loadScheduleLabels();
  if (labels && labels[index] !== undefined) return labels[index].label;
  const def = getDefault('prod_schedule_labels_v1');
  if (def && def[index] !== undefined) return def[index].label;
  return `Окно расписания ${index + 1}`;
}
function getSlotSub(index) {
  const labels = loadScheduleLabels();
  if (labels && labels[index] !== undefined) return labels[index].sub || '';
  const def = getDefault('prod_schedule_labels_v1');
  if (def && def[index] !== undefined) return def[index].sub || '';
  return '';
}

function startEditSlotLabel(index) {
  const el = document.getElementById('slot-label-' + index);
  if (!el) return;
  const currentLabel = getSlotLabel(index);
  const currentSub = getSlotSub(index);
  el.innerHTML = `
    <input class="slot-edit-input" id="slot-edit-label-${index}" value="${currentLabel.replace(/"/g, '&quot;')}" placeholder="Название" />
    <input class="slot-edit-input slot-edit-sub" id="slot-edit-sub-${index}" value="${currentSub.replace(/"/g, '&quot;')}" placeholder="Описание" />
    <button class="slot-edit-ok" onclick="saveSlotLabel(${index})">OK</button>
    <button class="slot-edit-cancel" onclick="renderTimeline()">✕</button>`;
  document.getElementById('slot-edit-label-' + index).focus();
  document.getElementById('slot-edit-label-' + index).addEventListener('keydown', e => { if (e.key === 'Enter') saveSlotLabel(index); if (e.key === 'Escape') renderTimeline(); });
  document.getElementById('slot-edit-sub-' + index).addEventListener('keydown', e => { if (e.key === 'Enter') saveSlotLabel(index); if (e.key === 'Escape') renderTimeline(); });
}

function saveSlotLabel(index) {
  const labelVal = document.getElementById('slot-edit-label-' + index).value.trim();
  const subVal = document.getElementById('slot-edit-sub-' + index).value.trim();
  if (!labelVal) return;
  const labels = loadScheduleLabels() || {};
  labels[index] = { label: labelVal, sub: subVal };
  saveScheduleLabels(labels);
  renderTimeline();
}

let lastActiveIndex = -1;

let _audioCtx = null;
function _initAudioCtx() {
  document.addEventListener('click', () => {
    if (!_audioCtx) {
      _audioCtx = new AudioContext();
    } else if (_audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
  }, { once: true });
}

function playTransitionChime() {
  if (!_audioCtx || _audioCtx.state !== 'running') return;
  try {
    const ctx = _audioCtx;
    const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 — мажорный аккорд
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  } catch (e) { /* Audio API недоступен */ }
}

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
    const label = getSlotLabel(activeIndex);
    const sub = getSlotSub(activeIndex);
    sendNotification('Новый блок расписания', `${s.time} — ${label}${sub ? '\n' + sub : ''}`);
    playTransitionChime();
    if (activeIndex === READING_SLOT_INDEX) notifyTaskSummary();
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
    const label    = getSlotLabel(i);
    const sub      = getSlotSub(i);

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
      <div class="slot-content" id="slot-label-${i}">
        <div class="slot-label">${escHtml(label)} <button class="slot-rename-btn" onclick="event.stopPropagation(); startEditSlotLabel(${i})" title="Переименовать">✎</button></div>
        ${sub ? `<div class="slot-sub">${escHtml(sub)}</div>` : ''}
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


function initSchedule() {
  _initAudioCtx();
  setInterval(renderTimeline, 30000);
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'schedule',
  render: renderTimeline,
  init: initSchedule,
});
