'use strict';

// ── Shared Utilities ────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1)  return '< 1 мин';
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function attachDragReorder(el, itemId, opts) {
  el.setAttribute('draggable', 'true');
  el.addEventListener('dragstart', e => {
    opts.srcRef.value = itemId;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => el.classList.add('dragging'), 0);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.querySelectorAll(opts.itemSelector + '.drag-over').forEach(i => i.classList.remove('drag-over'));
  });
  el.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (opts.srcRef.value !== itemId) {
      document.querySelectorAll(opts.itemSelector + '.drag-over').forEach(i => i.classList.remove('drag-over'));
      el.classList.add('drag-over');
    }
  });
  el.addEventListener('dragleave', e => {
    if (e.target === el || el.contains(e.relatedTarget) === false) {
      el.classList.remove('drag-over');
    }
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over');
    if (opts.srcRef.value === itemId) return;
    const items = opts.loadFn();
    const srcIdx = items.findIndex(t => t.id === opts.srcRef.value);
    const dstIdx = items.findIndex(t => t.id === itemId);
    if (srcIdx === -1 || dstIdx === -1) return;
    const [moved] = items.splice(srcIdx, 1);
    items.splice(dstIdx, 0, moved);
    opts.saveFn(items);
    opts.renderFn();
  });
}

function attachRenameInput(el, currentText, opts) {
  const input = document.createElement('input');
  input.className = opts.inputClass || 'todo-rename-input';
  input.maxLength = opts.maxLength || 480;
  input.value = currentText;
  el.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  function save() {
    if (saved) return;
    saved = true;
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      opts.onSave(newText);
    } else {
      opts.onRender();
    }
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { saved = true; opts.onRender(); }
  });
  input.addEventListener('blur', save);
}

function showToast(msg, container) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  (container || document.body).appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove());
  }, 1500);
}
