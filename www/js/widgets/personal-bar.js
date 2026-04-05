'use strict';

// ── Days counter ──────────────────────────────────────────────────────────
const DAYS_KEY = 'prod_days_v1';

function loadDaysData() {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY)); } catch { return null; }
}
function saveDaysData(d) { localStorage.setItem(DAYS_KEY, JSON.stringify(d)); }

function renderDaysCounter() {
  let data = loadDaysData();
  if (!data || !data.startDate) {
    const def = getDefault('prod_days_v1');
    if (def && def.startDate) {
      data = { startDate: def.startDate, failCount: (data && data.failCount) || def.failCount || 0 };
    } else {
      // No data yet (defaults not loaded) — show empty state, don't save hardcoded values
      document.getElementById('days-counter').textContent = '—';
      document.getElementById('days-since-label').textContent = '';
      const badgesEl = document.getElementById('days-fail-badges');
      if (badgesEl) { badgesEl.innerHTML = ''; badgesEl.style.display = 'none'; }
      return;
    }
  }
  const start = new Date(data.startDate + 'T00:00:00');
  const days  = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  document.getElementById('days-counter').textContent = days;
  const startFmt = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('days-since-label').textContent = `с ${startFmt}`;

  const badgesEl = document.getElementById('days-fail-badges');
  if (badgesEl) {
    if (data.failCount > 0) {
      badgesEl.innerHTML = Array(data.failCount).fill('<span class="fail-badge" title="Попытка бросить">💔</span>').join('');
      badgesEl.style.display = '';
    } else {
      badgesEl.innerHTML = '';
      badgesEl.style.display = 'none';
    }
  }
}

function resetDaysCounter() {
  if (!confirm('Сбросить счётчик? Это отметит нарушение.')) return;
  const data = loadDaysData() || { startDate: '', failCount: 0 };
  data.failCount = (data.failCount || 0) + 1;
  data.startDate = new Date().toISOString().slice(0, 10);
  saveDaysData(data);
  }

function editDaysDate() {
  const data = loadDaysData() || { startDate: new Date().toISOString().slice(0, 10), failCount: 0 };
  const newDate = prompt('Введите дату начала (ГГГГ-ММ-ДД):', data.startDate);
  if (!newDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { alert('Неверный формат. Используйте ГГГГ-ММ-ДД'); return; }
  const d = new Date(newDate + 'T00:00:00');
  if (isNaN(d.getTime())) { alert('Некорректная дата'); return; }
  data.startDate = newDate;
  saveDaysData(data);
  }


// ── Financial cushions ────────────────────────────────────────────────────
const CUSHION_KEY = 'prod_cushions';

function getCushions() {
  const raw = localStorage.getItem(CUSHION_KEY);
  if (raw !== null) return parseInt(raw, 10);
  const def = getDefault('prod_cushions');
  return def != null ? Number(def) : 0;
}
function renderCushions() {
  document.getElementById('cushion-count').textContent = getCushions();
}
function changeCushions(delta) {
  const val = Math.max(0, getCushions() + delta);
  localStorage.setItem(CUSHION_KEY, val);
  }

// ── Mortgage ───────────────────────────────────────────────────────────────
const MORTGAGE_KEY = 'prod_mortgage_v1';

function loadMortgage() {
  try { return JSON.parse(localStorage.getItem(MORTGAGE_KEY) || '{}'); } catch { return {}; }
}
function saveMortgageData(d) { localStorage.setItem(MORTGAGE_KEY, JSON.stringify(d)); }

function fmtRub(n) {
  const num = parseFloat(n) || 0;
  const hasKopecks = num % 1 !== 0;
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: hasKopecks ? 2 : 0,
    maximumFractionDigits: 2,
  }) + ' ₽';
}
function fmtMortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function renderMortgage() {
  const d = loadMortgage();
  document.getElementById('mort-payment').textContent = fmtRub(d.payment || 0);
  document.getElementById('mort-debt').textContent    = fmtRub(d.debt    || 0);

  const rateEl = document.getElementById('mort-rate');
  rateEl.textContent = (d.rate || 0) + '%';

  const datesEl = document.getElementById('mort-dates');
  const start = fmtMortDate(d.startDate);
  const end   = fmtMortDate(d.endDate);
  if (d.startDate || d.endDate) {
    datesEl.textContent = start + ' → ' + end;
  } else {
    datesEl.textContent = '—';
  }

  const paydayEl = document.getElementById('mort-payday');
  paydayEl.textContent = d.payDay ? d.payDay + '-го числа' : '—';
}

function toggleMortgageEdit() {
  const panel  = document.getElementById('mortgage-edit-panel');
  const body   = document.getElementById('mortgage-display');
  const btn    = document.getElementById('mortgage-edit-btn');
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    body.style.display  = '';
    btn.classList.remove('active');
  } else {
    const d = loadMortgage();
    document.getElementById('mort-input-payment').value  = d.payment  || '';
    document.getElementById('mort-input-debt').value     = d.debt     || '';
    document.getElementById('mort-input-rate').value     = d.rate     || '';
    document.getElementById('mort-input-start').value    = d.startDate || '';
    document.getElementById('mort-input-end').value      = d.endDate   || '';
    document.getElementById('mort-input-payday').value   = d.payDay   || '';
    panel.style.display = '';
    body.style.display  = 'none';
    btn.classList.add('active');
  }
}

function closeMortgageEdit() {
  document.getElementById('mortgage-edit-panel').style.display = 'none';
  document.getElementById('mortgage-display').style.display    = '';
  document.getElementById('mortgage-edit-btn').classList.remove('active');
}

function saveMortgage() {
  const d = {
    payment:   parseFloat(document.getElementById('mort-input-payment').value) || 0,
    debt:      parseFloat(document.getElementById('mort-input-debt').value)    || 0,
    rate:      parseFloat(document.getElementById('mort-input-rate').value)  || 0,
    startDate: document.getElementById('mort-input-start').value  || '',
    endDate:   document.getElementById('mort-input-end').value    || '',
    payDay:    parseInt(document.getElementById('mort-input-payday').value,  10) || 0,
  };
  saveMortgageData(d);
  closeMortgageEdit();
  }


function renderPersonalBar() {
  renderDaysCounter();
  renderCushions();
  renderMortgage();
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'personal-bar',
  render: renderPersonalBar,
});
