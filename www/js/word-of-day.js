'use strict';

// ── Word of the Day ───────────────────────────────────────────────────────

const WOD_CACHE_KEY   = 'prod_wod_cache';
const WOD_ARCHIVE_KEY = 'prod_wod_archive_v1';

/** Возвращает индекс слова на основе текущей даты */
function getDayIndex(total) {
  const now  = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return seed % total;
}

/** Запуск */
async function initWordOfDay() {
  setWodLoading(true);

  let words;
  try {
    const r = await fetch('/data/words.json');
    words = await r.json();
  } catch {
    setWodError('Не удалось загрузить список слов');
    return;
  }

  const idx   = getDayIndex(words.length);
  const word  = words[idx];
  const today = new Date().toISOString().slice(0, 10);

  const cached = getCachedWod();
  // Используем кэш только если он содержит все актуальные поля
  const cacheValid = cached
    && cached.date   === today
    && cached.word   === word
    && cached.wordRu !== undefined
    && Array.isArray(cached.examples)
    && cached.examples.length > 0;
  if (cacheValid) {
    renderWod(cached);
    return;
  }

  try {
    const data = await fetchWordData(word);
    saveWodCache(today, data);
    saveToWodArchive(data);
    renderWod(data);
  } catch {
    if (cached) {
      renderWod(cached);
      document.getElementById('wod-notice').textContent = '(офлайн — показано последнее слово)';
    } else {
      setWodError('API недоступен. Проверьте соединение.');
    }
  }
}

/** Получает полные данные о слове */
async function fetchWordData(word) {
  const dictResp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  if (!dictResp.ok) throw new Error('dict error');
  const dictData = await dictResp.json();
  const entry    = dictData[0];

  const phonetic = entry.phonetics?.find(p => p.text)?.text || '';
  const meanings = entry.meanings || [];

  // Первое значение
  const meaning    = meanings[0] || {};
  const pos        = meaning.partOfSpeech || '';
  const definition = meaning.definitions?.[0]?.definition || '';

  // Синонимы из всех значений (до 8)
  const synonymSet = new Set();
  meanings.forEach(m => {
    (m.synonyms || []).forEach(s => synonymSet.add(s));
    (m.definitions || []).forEach(d => (d.synonyms || []).forEach(s => synonymSet.add(s)));
  });
  const synonyms = [...synonymSet].slice(0, 8);

  // Примеры из всех значений/определений (до 3)
  const exampleTexts = [];
  for (const m of meanings) {
    for (const d of m.definitions || []) {
      if (d.example && exampleTexts.length < 3) exampleTexts.push(d.example);
    }
  }

  // Если API не вернул примеры — генерируем шаблонные по части речи
  if (exampleTexts.length < 2) {
    for (const s of buildFallbackExamples(word, pos)) {
      if (exampleTexts.length < 3) exampleTexts.push(s);
    }
  }

  // Параллельные переводы: само слово (мужской род) + определение + примеры
  const [wordRu, translation, ...examplesRu] = await Promise.all([
    translateWordMasculine(word, pos),
    translateToRu(definition),
    ...exampleTexts.map(ex => translateToRu(ex)),
  ]);

  const examples = exampleTexts.map((en, i) => ({ en, ru: examplesRu[i] || '' }));

  return {
    word, wordRu, phonetic, pos,
    definition, translation,
    synonyms, examples,
    date: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Переводит прилагательное в мужском роде,
 * для остальных частей речи — обычный перевод.
 */
async function translateWordMasculine(word, pos) {
  if (pos && pos.toLowerCase().includes('adjective')) {
    // «a [word] man» → «неумолимый человек» → берём первое слово
    const phrase     = await translateToRu(`a ${word} man`);
    const firstWord  = (phrase || '').split(/\s+/)[0].replace(/[.,;:!?«»"']/g, '');
    if (firstWord && /[а-яёА-ЯЁ]/.test(firstWord)) return firstWord;
  }
  return translateToRu(word);
}

/**
 * Шаблонные примеры по части речи —
 * используются когда словарный API не возвращает примеров.
 */
function buildFallbackExamples(word, pos) {
  const p = (pos || '').toLowerCase();
  if (p.includes('adjective')) {
    return [
      `His ${word} resolve left no room for doubt.`,
      `The ${word} logic of events unfolded before them.`,
      `She remained ${word} despite every obstacle in her path.`,
    ];
  }
  if (p.includes('verb')) {
    return [
      `She decided to ${word} the process step by step.`,
      `They had to ${word} their approach to solve the problem.`,
      `He learned to ${word} his thoughts under pressure.`,
    ];
  }
  // noun / other
  return [
    `The idea of ${word} fascinated philosophers for centuries.`,
    `Understanding ${word} is key to mastering the subject.`,
    `${word.charAt(0).toUpperCase() + word.slice(1)} shapes the way we see the world.`,
  ];
}

/** MyMemory API — бесплатный перевод en→ru */
async function translateToRu(text) {
  if (!text) return '';
  const url  = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
  const resp = await fetch(url);
  const data = await resp.json();
  return data?.responseData?.translatedText || text;
}

/** Рендер текущего слова */
function renderWod(data) {
  setWodLoading(false);
  document.getElementById('wod-section').classList.add('loaded');

  document.getElementById('wod-word').textContent     = data.word;
  document.getElementById('wod-word-ru').textContent  = data.wordRu || '';
  document.getElementById('wod-phonetic').textContent = data.phonetic || '';
  document.getElementById('wod-pos').textContent      = data.pos || '';
  document.getElementById('wod-definition').textContent  = data.definition || '—';
  document.getElementById('wod-translation').textContent = data.translation || '—';

  // Синонимы
  const synBlock = document.getElementById('wod-synonyms-block');
  const synList  = document.getElementById('wod-synonyms');
  if (data.synonyms && data.synonyms.length) {
    synList.innerHTML = data.synonyms
      .map(s => `<span class="wod-syn-tag">${escHtml(s)}</span>`)
      .join('');
    synBlock.style.display = '';
  } else {
    synBlock.style.display = 'none';
  }

  // Примеры
  const exBlock = document.getElementById('wod-examples-block');
  const exList  = document.getElementById('wod-examples-list');
  if (data.examples && data.examples.length) {
    exList.innerHTML = data.examples.map((ex, i) => `
      <div class="wod-example-item" id="wod-ex-item-${i}">
        <div class="wod-example-header">
          <div class="wod-example-num">Пример ${i + 1}</div>
          <button class="wod-example-edit-btn" onclick="startEditExample(${i})" title="Редактировать пример">✎</button>
        </div>
        <div class="wod-example-en">"${escHtml(ex.en)}"</div>
        ${ex.ru ? `<div class="wod-example-ru">«${escHtml(ex.ru)}»</div>` : ''}
      </div>`).join('');
    exBlock.style.display = '';
  } else {
    exBlock.style.display = 'none';
  }
}

function startEditExample(idx) {
  const cached = getCachedWod();
  if (!cached || !cached.examples || !cached.examples[idx]) return;
  const ex = cached.examples[idx];
  const itemEl = document.getElementById(`wod-ex-item-${idx}`);
  if (!itemEl) return;

  itemEl.innerHTML = `
    <div class="wod-example-header">
      <div class="wod-example-num">Пример ${idx + 1}</div>
    </div>
    <div class="wod-example-edit-row">
      <label class="wod-example-edit-label">EN</label>
      <textarea class="wod-example-edit-input" id="wod-ex-en-${idx}" rows="2">${escHtml(ex.en)}</textarea>
    </div>
    <div class="wod-example-edit-row">
      <label class="wod-example-edit-label">RU</label>
      <textarea class="wod-example-edit-input" id="wod-ex-ru-${idx}" rows="2">${escHtml(ex.ru || '')}</textarea>
    </div>
    <div class="wod-example-edit-actions">
      <button class="wod-example-save-btn" onclick="saveExample(${idx})">Сохранить</button>
      <button class="wod-example-cancel-btn" onclick="cancelEditExample()">Отмена</button>
    </div>`;
}

function saveExample(idx) {
  const enEl = document.getElementById(`wod-ex-en-${idx}`);
  const ruEl = document.getElementById(`wod-ex-ru-${idx}`);
  if (!enEl) return;
  const newEn = enEl.value.trim();
  const newRu = ruEl ? ruEl.value.trim() : '';
  if (!newEn) return;

  const cached = getCachedWod();
  if (!cached || !cached.examples || !cached.examples[idx]) return;
  cached.examples[idx] = { en: newEn, ru: newRu };
  localStorage.setItem(WOD_CACHE_KEY, JSON.stringify(cached));
  saveToWodArchive(cached);
  renderWod(cached);
}

function cancelEditExample() {
  const cached = getCachedWod();
  if (cached) renderWod(cached);
}

// ── Cache ─────────────────────────────────────────────────────────────────

function getCachedWod() {
  try { return JSON.parse(localStorage.getItem(WOD_CACHE_KEY)); } catch { return null; }
}
function saveWodCache(date, data) {
  localStorage.setItem(WOD_CACHE_KEY, JSON.stringify({ ...data, date }));
}

// ── Archive ───────────────────────────────────────────────────────────────

function loadWodArchive() {
  try { return JSON.parse(localStorage.getItem(WOD_ARCHIVE_KEY) || '[]'); } catch { return []; }
}

function saveToWodArchive(data) {
  const archive = loadWodArchive();
  const idx = archive.findIndex(a => a.date === data.date);
  if (idx !== -1) {
    archive[idx] = data;
  } else {
    archive.unshift(data);
  }
  localStorage.setItem(WOD_ARCHIVE_KEY, JSON.stringify(archive.slice(0, 90)));
}

function toggleWodArchive() {
  const panel = document.getElementById('wod-archive-panel');
  const btn   = document.getElementById('wod-archive-btn');
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    btn.classList.remove('active');
  } else {
    renderWodArchive();
    panel.style.display = '';
    btn.classList.add('active');
  }
}

function renderWodArchive() {
  const archive = loadWodArchive();
  const list    = document.getElementById('wod-archive-list');

  if (!archive.length) {
    list.innerHTML = '<div class="wod-archive-empty">Архив пуст — слова появятся по мере использования приложения</div>';
    return;
  }

  list.innerHTML = archive.map((a, i) => `
    <div class="wod-archive-row">
      <div class="wod-archive-item" id="wod-arc-item-${i}" onclick="toggleArchiveDetail(${i})">
        <div class="wod-archive-meta">
          <span class="wod-archive-word">${escHtml(a.word)}</span>
          ${a.wordRu ? `<span class="wod-archive-word-ru">${escHtml(a.wordRu)}</span>` : ''}
          ${a.pos    ? `<span class="wod-archive-pos">${escHtml(a.pos)}</span>`         : ''}
        </div>
        <span class="wod-archive-date">${fmtArchiveDate(a.date)}</span>
      </div>
      <div class="wod-archive-detail" id="wod-arc-detail-${i}" style="display:none">
        ${buildArchiveDetail(a)}
      </div>
    </div>`).join('');
}

function toggleArchiveDetail(i) {
  const detail  = document.getElementById(`wod-arc-detail-${i}`);
  const header  = document.getElementById(`wod-arc-item-${i}`);
  const isOpen  = detail.style.display !== 'none';

  // Закрываем все
  document.querySelectorAll('.wod-archive-detail').forEach(d => { d.style.display = 'none'; });
  document.querySelectorAll('.wod-archive-item').forEach(h => h.classList.remove('expanded'));

  if (!isOpen) {
    detail.style.display = '';
    header.classList.add('expanded');
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function buildArchiveDetail(a) {
  const syns = (a.synonyms || []).length
    ? `<div class="wod-archive-syns">
        ${a.synonyms.map(s => `<span class="wod-syn-tag">${escHtml(s)}</span>`).join('')}
       </div>`
    : '';

  const exs = (a.examples || []).length
    ? `<div class="wod-archive-examples">
        ${a.examples.map(ex => `
          <div>
            <div class="wod-archive-ex-en">"${escHtml(ex.en)}"</div>
            ${ex.ru ? `<div class="wod-archive-ex-ru">«${escHtml(ex.ru)}»</div>` : ''}
          </div>`).join('')}
       </div>`
    : '';

  return `
    <div class="wod-archive-def-en">${escHtml(a.definition || '—')}</div>
    <div class="wod-archive-def-ru">${escHtml(a.translation || '—')}</div>
    ${syns}
    ${exs}`;
}

function fmtArchiveDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── Utils ─────────────────────────────────────────────────────────────────

function setWodLoading(on) {
  document.getElementById('wod-loading').style.display  = on ? '' : 'none';
  document.getElementById('wod-content').style.display  = on ? 'none' : '';
}

function setWodError(msg) {
  setWodLoading(false);
  document.getElementById('wod-word').textContent   = '—';
  document.getElementById('wod-notice').textContent = msg;
}

// Запуск
document.addEventListener('DOMContentLoaded', initWordOfDay);

// ── Registration ────────────────────────────────────────────────────────
if (typeof registerWidget === 'function') {
  registerWidget({
    id: 'wod',
    label: 'Слово дня',
    zone: 'top',
    storageKeys: ['prod_wod_cache', 'prod_wod_archive_v1'],
  });
}
