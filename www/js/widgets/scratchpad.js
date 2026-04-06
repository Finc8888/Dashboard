'use strict';

// ── Scratchpad ───────────────────────────────────────────────────────────
const SCRATCHPAD_KEY = 'prod_scratchpad_v1';

function loadScratchpad() { return loadJSON(SCRATCHPAD_KEY, {}); }
function saveScratchpad(data) { localStorage.setItem(SCRATCHPAD_KEY, JSON.stringify(data)); }

function initScratchpad() {
  const data = loadScratchpad();
  const today = localDateStr(new Date());
  const textarea = document.getElementById('scratchpad-textarea');
  if (!textarea) return;

  // Archive previous day if needed
  if (data.date && data.date !== today && data.text) {
    if (!data.history) data.history = {};
    data.history[data.date] = data.text;
    data.text = '';
    data.date = today;
    saveScratchpad(data);
  }

  textarea.value = data.date === today ? (data.text || '') : '';

  let saveTimer = null;
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const d = loadScratchpad();
      d.text = textarea.value;
      d.date = localDateStr(new Date());
      saveScratchpad(d);
      const status = document.getElementById('scratchpad-status');
      status.textContent = 'сохранено';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }, 500);
  });
}

function scratchpadToTask() {
  const textarea = document.getElementById('scratchpad-textarea');
  const text = textarea.value.trim();
  if (!text) return;
  // Take first line as task
  const firstLine = text.split('\n')[0].slice(0, 120);
  addTask(firstLine);
  textarea.value = '';
  const d = loadScratchpad();
  d.text = '';
  d.date = localDateStr(new Date());
  saveScratchpad(d);
}

function toggleScratchpadHistory() {
  const panel = document.getElementById('scratchpad-history');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  const data = loadScratchpad();
  const history = data.history || {};
  const dates = Object.keys(history).sort().reverse();
  if (!dates.length) {
    panel.innerHTML = '<div style="color:var(--muted);font-size:13px;">Пока пусто</div>';
  } else {
    panel.innerHTML = dates.slice(0, 14).map(d => {
      const dt = new Date(d + 'T00:00:00');
      const label = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', weekday: 'short' });
      return `<div class="scratchpad-history-day">
        <div class="scratchpad-history-date">${label}</div>
        <div class="scratchpad-history-text">${escHtml(history[d])}</div>
      </div>`;
    }).join('');
  }
  panel.style.display = '';
}


// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'scratchpad',
  render: initScratchpad,
});
