'use strict';

// ── Zen / Focus Mode ─────────────────────────────────────────────────────
function showBtnTooltip(btn, msg) {
  const existing = btn.parentElement.querySelector('.btn-tooltip');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'btn-tooltip';
  el.textContent = msg;
  btn.style.position = btn.style.position || 'relative';
  btn.parentElement.style.position = 'relative';
  btn.parentElement.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove());
  }, 2500);
}

let zenMode = localStorage.getItem('prod_zen_mode') === '1';
function toggleZenMode() {
  if (!zenMode && dayOff) {
    showBtnTooltip(document.getElementById('zen-btn'), 'Сегодня выходной — отдохни, чтобы лучше фокусироваться в рабочий день');
    return;
  }
  zenMode = !zenMode;
  localStorage.setItem('prod_zen_mode', zenMode ? '1' : '0');
  document.body.classList.toggle('zen-active', zenMode);
}
function restoreZenMode() {
  if (zenMode) document.body.classList.add('zen-active');
}

let dayOff = localStorage.getItem('prod_day_off') === '1';
function toggleDayOff() {
  if (!dayOff && zenMode) {
    showBtnTooltip(document.getElementById('dayoff-btn'), 'Сначала выйди из фокус-режима');
    return;
  }
  dayOff = !dayOff;
  localStorage.setItem('prod_day_off', dayOff ? '1' : '0');
  const btn = document.getElementById('dayoff-btn');
  btn.classList.toggle('active', dayOff);
  btn.title = dayOff ? 'Выходной день (включено)' : 'Выходной день';
  applyWidgetVisibility();
}
function restoreDayOff() {
  if (dayOff) {
    const btn = document.getElementById('dayoff-btn');
    btn.classList.add('active');
    btn.title = 'Выходной день (включено)';
  }
}
if (zenMode && dayOff) {
  zenMode = false;
  localStorage.setItem('prod_zen_mode', '0');
}
restoreZenMode();
restoreDayOff();


// ── Scroll arrows ────────────────────────────────────────────────────────
function initScrollArrows() {
  const wrap = document.createElement('div');
  wrap.className = 'scroll-arrows';
  wrap.innerHTML = `
    <button class="scroll-arrow scroll-arrow-up" onclick="scrollToEdge('top')" title="В начало (Home)">&#x2191;</button>
    <button class="scroll-arrow scroll-arrow-down" onclick="scrollToEdge('bottom')" title="В конец (End)">&#x2193;</button>`;
  document.body.appendChild(wrap);

  const upBtn = wrap.querySelector('.scroll-arrow-up');
  const downBtn = wrap.querySelector('.scroll-arrow-down');

  function updateArrows() {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    upBtn.classList.toggle('visible', scrollY > 200);
    downBtn.classList.toggle('visible', scrollY < maxScroll - 200);
  }
  window.addEventListener('scroll', updateArrows, { passive: true });
  updateArrows();
}
initScrollArrows();
