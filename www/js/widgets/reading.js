'use strict';

// ── Reading List ───────────────────────────────────────────────────────
const READING_KEY = 'prod_reading_v1';
const READING_BOOKS_KEY = 'prod_reading_books_v1';

function loadReadingBooks() { return loadJSON(READING_BOOKS_KEY, []); }
function saveReadingBooks(books) { localStorage.setItem(READING_BOOKS_KEY, JSON.stringify(books)); }

function loadReading() { return loadJSON(READING_KEY, {}); }
function saveReading(data) { localStorage.setItem(READING_KEY, JSON.stringify(data)); }

function getBookState(data, id) {
  return data[id] || { status: 'waiting', page: 0, startedAt: null };
}

let _readingEditMode = false;
const expandedBooks = {};

function toggleBookExpand(id) {
  expandedBooks[id] = !expandedBooks[id];
  renderReadingList();
}

function toggleReadingEditMode() {
  _readingEditMode = !_readingEditMode;
  renderReadingList();
}

function addBook() {
  const titleEl = document.getElementById('reading-add-title');
  const authorEl = document.getElementById('reading-add-author');
  const typeEl = document.getElementById('reading-add-type');
  if (!titleEl) return;
  const title = titleEl.value.trim();
  const author = authorEl.value.trim();
  const type = typeEl.value.trim() || 'роман';
  if (!title) return;
  const books = loadReadingBooks();
  const id = 'book-' + Date.now();
  books.push({ id, title, author, type });
  saveReadingBooks(books);
  titleEl.value = '';
  authorEl.value = '';
  typeEl.value = '';
  renderReadingList();
}

function removeBook(id) {
  if (!confirm('Удалить книгу из списка?')) return;
  let books = loadReadingBooks();
  const book = books.find(b => b.id === id);
  books = books.filter(b => b.id !== id);
  saveReadingBooks(books);
  const data = loadReading();
  delete data[id];
  if (book && book.subItems) book.subItems.forEach(s => delete data[s.id]);
  saveReading(data);
  renderReadingList();
}

function moveBook(id, dir) {
  const books = loadReadingBooks();
  const idx = books.findIndex(b => b.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= books.length) return;
  [books[idx], books[newIdx]] = [books[newIdx], books[idx]];
  saveReadingBooks(books);
  renderReadingList();
}

function startEditBook(id) {
  const books = loadReadingBooks();
  const book = books.find(b => b.id === id);
  if (!book) return;
  const el = document.getElementById('book-row-' + id);
  if (!el) return;
  el.innerHTML = `
    <div class="book-edit-form">
      <input class="book-edit-input" id="edit-title-${id}" value="${(book.title || '').replace(/"/g, '&quot;')}" placeholder="Название" />
      <input class="book-edit-input" id="edit-author-${id}" value="${(book.author || '').replace(/"/g, '&quot;')}" placeholder="Автор" />
      <input class="book-edit-input book-edit-type" id="edit-type-${id}" value="${(book.type || '').replace(/"/g, '&quot;')}" placeholder="Тип" />
      <button class="book-edit-save" onclick="saveEditBook('${id}')">OK</button>
      <button class="book-edit-cancel" onclick="renderReadingList()">✕</button>
    </div>`;
}

function saveEditBook(id) {
  const books = loadReadingBooks();
  const book = books.find(b => b.id === id);
  if (!book) return;
  const title = document.getElementById('edit-title-' + id).value.trim();
  const author = document.getElementById('edit-author-' + id).value.trim();
  const type = document.getElementById('edit-type-' + id).value.trim();
  if (!title) return;
  book.title = title;
  book.author = author;
  book.type = type || 'роман';
  saveReadingBooks(books);
  renderReadingList();
}

function clearReadingList() {
  if (!confirm('Очистить весь список чтения? Все книги и прогресс будут удалены.')) return;
  saveReadingBooks([]);
  saveReading({});
  renderReadingList();
}

function cycleBookStatus(id) {
  const books = loadReadingBooks();
  const data  = loadReading();
  const state = getBookState(data, id);
  const order = ['waiting', 'reading', 'done'];
  const next  = order[(order.indexOf(state.status) + 1) % order.length];

  if (next === 'reading') {
    books.forEach(b => {
      if (b.id !== id && getBookState(data, b.id).status === 'reading') {
        data[b.id] = { ...getBookState(data, b.id), status: 'done' };
      }
    });
  }

  data[id] = {
    ...state,
    status: next,
    startedAt: next === 'reading' && !state.startedAt ? todayStr() : state.startedAt,
  };

  const book = books.find(b => b.id === id);
  if (book && book.subItems) {
    if (next === 'done') book.subItems.forEach(s => { data[s.id] = { ...getBookState(data, s.id), status: 'done' }; });
    if (next === 'waiting') book.subItems.forEach(s => { data[s.id] = { ...getBookState(data, s.id), status: 'waiting' }; });
  }

  saveReading(data);
  renderReadingList();
}

function toggleSubItemStatus(bookId, subId) {
  const books = loadReadingBooks();
  const data = loadReading();
  const state = getBookState(data, subId);
  const next = state.status === 'done' ? 'waiting' : 'done';
  data[subId] = { ...state, status: next };
  const book = books.find(b => b.id === bookId);
  if (book && book.subItems) {
    const allDone = book.subItems.every(s => getBookState(data, s.id).status === 'done');
    const anyStarted = book.subItems.some(s => getBookState(data, s.id).status !== 'waiting');
    const parentState = getBookState(data, book.id);
    if (allDone) data[book.id] = { ...parentState, status: 'done' };
    else if (anyStarted && parentState.status === 'done') data[book.id] = { ...parentState, status: 'reading', startedAt: parentState.startedAt || todayStr() };
  }
  saveReading(data);
  renderReadingList();
}

function updateBookPage(id, value) {
  const data  = loadReading();
  const state = getBookState(data, id);
  const page  = Math.max(0, parseInt(value, 10) || 0);
  data[id] = { ...state, page };
  saveReading(data);
  const label = document.getElementById('book-page-since-' + id);
  if (label && state.startedAt) label.textContent = `с ${state.startedAt}`;
}

const STATUS_ICON = { waiting: '⬜', reading: '🔄', done: '✅' };

function renderReadingList() {
  const books     = loadReadingBooks();
  const data      = loadReading();
  const total     = books.length;
  const doneCount = books.filter(b => getBookState(data, b.id).status === 'done').length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  document.getElementById('reading-done-count').textContent = doneCount;
  document.getElementById('reading-total-count').textContent = total;
  document.getElementById('reading-progress-fill').style.width = pct + '%';

  const container = document.getElementById('reading-books');
  container.innerHTML = '';

  if (total === 0) {
    container.innerHTML = '<div class="reading-empty">Список пуст. Добавьте книги для чтения.</div>';
  }

  books.forEach((book, idx) => {
    const state   = getBookState(data, book.id);
    const { status, page, startedAt } = state;
    const hasSubs = book.subItems && book.subItems.length > 0;
    const isExpanded = expandedBooks[book.id];

    const el = document.createElement('div');
    el.className = 'book-item book-' + status;
    el.id = 'book-row-' + book.id;

    const pageRow = status === 'reading' ? `
      <div class="book-page-row">
        <span class="book-page-label">Страница:</span>
        <input
          class="book-page-input"
          id="book-page-input-${book.id}"
          type="number"
          min="0"
          value="${page}"
          onchange="updateBookPage('${book.id}', this.value)"
        />
        <span class="book-page-since" id="book-page-since-${book.id}">${startedAt ? 'с ' + startedAt : ''}</span>
      </div>` : '';

    const subsDoneCount = hasSubs ? book.subItems.filter(s => getBookState(data, s.id).status === 'done').length : 0;
    const subsCounter = hasSubs ? `<span class="book-subs-counter">${subsDoneCount}/${book.subItems.length}</span>` : '';
    const expandBtn = hasSubs ? `<button class="book-expand-btn${isExpanded ? ' expanded' : ''}" onclick="toggleBookExpand('${book.id}')" title="Раскрыть содержание">▸</button>` : '';

    const editBtns = _readingEditMode ? `
      <div class="book-edit-actions">
        <button class="book-move-btn" onclick="moveBook('${book.id}', -1)" title="Вверх" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="book-move-btn" onclick="moveBook('${book.id}', 1)" title="Вниз" ${idx === total - 1 ? 'disabled' : ''}>▼</button>
        <button class="book-edit-btn" onclick="startEditBook('${book.id}')" title="Редактировать">✎</button>
        <button class="book-remove-btn" onclick="removeBook('${book.id}')" title="Удалить">✕</button>
      </div>` : '';

    el.innerHTML = `
      <button class="book-status-btn" onclick="cycleBookStatus('${book.id}')" title="Изменить статус">
        ${STATUS_ICON[status]}
      </button>
      <div class="book-body">
        <div class="book-main-row">
          <span class="book-num">${idx + 1}.</span>
          <span class="book-title">${book.title}</span>
          <span class="book-type">${book.type || ''}</span>
          ${subsCounter}
          ${expandBtn}
          ${editBtns}
        </div>
        <div class="book-author">${book.author || ''}</div>
        ${pageRow}
      </div>`;

    container.appendChild(el);

    if (hasSubs && isExpanded) {
      const subsEl = document.createElement('div');
      subsEl.className = 'book-subs-list';
      book.subItems.forEach(sub => {
        const subState = getBookState(data, sub.id);
        const subDone = subState.status === 'done';
        const subItem = document.createElement('div');
        subItem.className = 'book-sub-item' + (subDone ? ' sub-done' : '');
        subItem.innerHTML = `
          <button class="book-sub-checkbox${subDone ? ' checked' : ''}" onclick="toggleSubItemStatus('${book.id}','${sub.id}')">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="book-sub-title">${sub.title}</span>`;
        subsEl.appendChild(subItem);
      });
      container.appendChild(subsEl);
    }
  });

  // Add book form (always visible at bottom)
  const addForm = document.createElement('div');
  addForm.className = 'reading-add-form';
  addForm.innerHTML = `
    <input class="reading-add-input" id="reading-add-title" placeholder="Название книги" />
    <input class="reading-add-input reading-add-author" id="reading-add-author" placeholder="Автор" />
    <input class="reading-add-input reading-add-type-input" id="reading-add-type" placeholder="Тип" />
    <button class="reading-add-btn" onclick="addBook()">+</button>`;
  container.appendChild(addForm);

  // Bind Enter on title input
  setTimeout(() => {
    const inp = document.getElementById('reading-add-title');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addBook(); });
  }, 0);
}


// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'reading',
  render: renderReadingList,
});
