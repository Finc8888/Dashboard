'use strict';

// ── Sticker Board (Доска напоминаний) ─────────────────────────────────
const STICKERS_KEY = 'prod_stickers_v1';

function loadStickers() {
  try { return JSON.parse(localStorage.getItem(STICKERS_KEY) || '[]'); } catch { return []; }
}
function saveStickers(list) {
  localStorage.setItem(STICKERS_KEY, JSON.stringify(list));
}

const STICKER_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a78bfa', '#06b6d4'];

function addSticker() {
  const input = document.getElementById('sticker-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const stickers = loadStickers();
  stickers.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    done: false,
    color: STICKER_COLORS[stickers.length % STICKER_COLORS.length],
    createdAt: new Date().toISOString(),
  });
  saveStickers(stickers);
  input.value = '';
  renderStickers();
}

function toggleSticker(id) {
  const stickers = loadStickers();
  const s = stickers.find(s => s.id === id);
  if (s) s.done = !s.done;
  saveStickers(stickers);
  renderStickers();
}

function deleteSticker(id) {
  const stickers = loadStickers().filter(s => s.id !== id);
  saveStickers(stickers);
  renderStickers();
}

function startEditSticker(id) {
  const stickers = loadStickers();
  const s = stickers.find(s => s.id === id);
  if (!s) return;
  const el = document.querySelector(`.sticker-note[data-id="${id}"] .sticker-text`);
  if (!el) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sticker-edit-input';
  input.value = s.text;
  input.maxLength = 120;
  el.replaceWith(input);
  input.focus();
  input.select();
  const save = () => {
    const val = input.value.trim();
    if (val && val !== s.text) {
      s.text = val;
      saveStickers(stickers);
    }
    renderStickers();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { renderStickers(); }
  });
}

function changeStickerColor(id) {
  const stickers = loadStickers();
  const s = stickers.find(s => s.id === id);
  if (!s) return;
  const idx = STICKER_COLORS.indexOf(s.color);
  s.color = STICKER_COLORS[(idx + 1) % STICKER_COLORS.length];
  saveStickers(stickers);
  renderStickers();
}

function renderStickers() {
  const board = document.getElementById('sticker-board');
  if (!board) return;
  const stickers = loadStickers();

  if (!stickers.length) {
    board.innerHTML = '<div class="sticker-empty">Доска пуста — добавьте напоминание</div>';
    return;
  }

  board.innerHTML = '';
  stickers.forEach(s => {
    const note = document.createElement('div');
    note.className = 'sticker-note' + (s.done ? ' done' : '');
    note.dataset.id = s.id;
    note.style.setProperty('--sticker-color', s.color);
    const tilt = ((parseInt(s.id, 36) % 7) - 3) * 0.8;
    note.style.transform = `rotate(${tilt}deg)`;

    note.innerHTML = `
      <div class="sticker-top">
        <div class="sticker-checkbox" onclick="toggleSticker('${s.id}')" title="Выполнено">
          ${s.done ? '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
        <span class="sticker-text">${escHtml(s.text)}</span>
      </div>
      <div class="sticker-actions">
        <button onclick="changeStickerColor('${s.id}')" title="Сменить цвет">🎨</button>
        <button onclick="startEditSticker('${s.id}')" title="Редактировать">✎</button>
        <button onclick="deleteSticker('${s.id}')" title="Удалить">×</button>
      </div>`;
    board.appendChild(note);
  });
}

function initStickers() {
  const input = document.getElementById('sticker-input');
  const btn = document.getElementById('sticker-add-btn');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addSticker(); });
  if (btn) btn.addEventListener('click', addSticker);
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'stickers',
  render: renderStickers,
  init: initStickers,
});
