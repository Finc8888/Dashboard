'use strict';

// ── Quote Banner ──────────────────────────────────────────────────────────
let allQuotes    = [];
let quoteIndex   = 0;
let quoteChangeAt = 0;
const QUOTE_INTERVAL = 60 * 60 * 1000;

function showQuote(q) {
  document.getElementById('quote-text').textContent = q.quote;
  const expl = document.getElementById('quote-expl');
  expl.textContent  = q.explanation || '';
  expl.style.display = q.explanation ? '' : 'none';
}

function nextQuote() {
  if (!allQuotes.length) return;
  quoteIndex++;
  if (quoteIndex >= allQuotes.length) {
    shuffleArray(allQuotes);
    quoteIndex = 0;
  }
  quoteChangeAt = Date.now() + QUOTE_INTERVAL;
  showQuote(allQuotes[quoteIndex]);
}

function updateCountdown() {
  const el = document.getElementById('quote-countdown');
  if (!el || !allQuotes.length) return;
  const remaining = Math.max(0, quoteChangeAt - Date.now());
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  el.textContent = `смена через ${m}:${String(s).padStart(2, '0')}`;
  if (remaining === 0) nextQuote();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderQuote() {
  if (allQuotes.length) showQuote(allQuotes[quoteIndex]);
}

function initQuote() {
  fetch('/quotes.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(data => {
      if (!Array.isArray(data) || !data.length) return;
      allQuotes = data.slice();
      shuffleArray(allQuotes);
      quoteIndex    = 0;
      quoteChangeAt = Date.now() + QUOTE_INTERVAL;
      showQuote(allQuotes[quoteIndex]);
      setInterval(updateCountdown, 1000);
      updateCountdown();
    })
    .catch(() => {});
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'quote',
  render: renderQuote,
  init: initQuote,
});
