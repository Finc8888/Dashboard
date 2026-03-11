'use strict';

// ── Word of the Day ───────────────────────────────────────────────────────

const WOD_CACHE_KEY = 'prod_wod_cache';

/** Возвращает индекс слова на основе текущей даты (одно слово = один день) */
function getDayIndex(total) {
  const now  = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return seed % total;
}

/** Загружает список слов и запускает логику */
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

  const idx  = getDayIndex(words.length);
  const word = words[idx];

  // Проверяем кэш (слово + дата)
  const today = new Date().toISOString().slice(0, 10);
  const cached = getCachedWod();
  if (cached && cached.date === today && cached.word === word) {
    renderWod(cached);
    return;
  }

  try {
    const data = await fetchWordData(word);
    saveWodCache(today, data);
    renderWod(data);
  } catch (e) {
    // Если API недоступен — показываем кэш прошлого дня если есть
    if (cached) {
      renderWod(cached);
      document.getElementById('wod-notice').textContent = '(офлайн — показано последнее слово)';
    } else {
      setWodError('API недоступен. Проверьте соединение.');
    }
  }
}

/** Получает данные о слове: словарь + перевод */
async function fetchWordData(word) {
  // 1. Free Dictionary API
  const dictResp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  if (!dictResp.ok) throw new Error('dict error');
  const dictData = await dictResp.json();
  const entry    = dictData[0];

  // Извлекаем данные из ответа
  const phonetic  = entry.phonetics?.find(p => p.text)?.text || '';
  const meanings  = entry.meanings || [];

  // Берём первое значение с определением
  const meaning   = meanings[0] || {};
  const pos       = meaning.partOfSpeech || '';
  const defs      = meaning.definitions || [];
  const definition = defs[0]?.definition || '';
  const example    = defs[0]?.example || defs[1]?.example || '';

  // 2. Переводим определение на русский
  const translation = await translateToRu(definition);

  // 3. Переводим пример если есть
  const exampleRu = example ? await translateToRu(example) : '';

  return { word, phonetic, pos, definition, translation, example, exampleRu, date: new Date().toISOString().slice(0, 10) };
}

/** MyMemory API — бесплатный перевод en→ru */
async function translateToRu(text) {
  if (!text) return '';
  const url  = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
  const resp = await fetch(url);
  const data = await resp.json();
  return data?.responseData?.translatedText || text;
}

/** Рендер виджета */
function renderWod(data) {
  setWodLoading(false);

  const section = document.getElementById('wod-section');
  section.classList.add('loaded');

  document.getElementById('wod-word').textContent     = data.word;
  document.getElementById('wod-phonetic').textContent = data.phonetic || '';
  document.getElementById('wod-pos').textContent      = data.pos || '';
  document.getElementById('wod-definition').textContent  = data.definition || '—';
  document.getElementById('wod-translation').textContent = data.translation || '—';

  const exampleBlock = document.getElementById('wod-example-block');
  if (data.example) {
    document.getElementById('wod-example-en').textContent = `"${data.example}"`;
    document.getElementById('wod-example-ru').textContent = data.exampleRu ? `«${data.exampleRu}»` : '';
    exampleBlock.style.display = '';
  } else {
    exampleBlock.style.display = 'none';
  }
}

function setWodLoading(on) {
  document.getElementById('wod-loading').style.display = on ? '' : 'none';
  document.getElementById('wod-content').style.display = on ? 'none' : '';
}

function setWodError(msg) {
  setWodLoading(false);
  document.getElementById('wod-content').style.display = '';
  document.getElementById('wod-word').textContent = '—';
  document.getElementById('wod-notice').textContent = msg;
}

function getCachedWod() {
  try { return JSON.parse(localStorage.getItem(WOD_CACHE_KEY)); } catch { return null; }
}
function saveWodCache(date, data) {
  localStorage.setItem(WOD_CACHE_KEY, JSON.stringify({ ...data, date }));
}

// Запуск
document.addEventListener('DOMContentLoaded', initWordOfDay);
