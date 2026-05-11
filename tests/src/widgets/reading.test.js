const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('reading.js');
  applyWidgetConfigSync();
});

describe('Reading — load / save books', () => {
  test('loadReadingBooks returns empty array when no data', () => {
    expect(loadReadingBooks()).toEqual([]);
  });

  test('saveReadingBooks / loadReadingBooks roundtrip', () => {
    const books = [{ id: 'b1', title: 'Солярис', author: 'Лем', type: 'роман' }];
    saveReadingBooks(books);
    expect(loadReadingBooks()).toEqual(books);
  });
});

describe('Reading — load / save progress', () => {
  test('loadReading returns empty object when no data', () => {
    expect(loadReading()).toEqual({});
  });

  test('saveReading / loadReading roundtrip', () => {
    const data = { b1: { status: 'reading', page: 42, startedAt: '2025-04-01' } };
    saveReading(data);
    expect(loadReading()).toEqual(data);
  });
});

describe('Reading — getBookState()', () => {
  test('returns default state for unknown book', () => {
    const state = getBookState({}, 'unknown');
    expect(state).toEqual({ status: 'waiting', page: 0, startedAt: null });
  });

  test('returns saved state for known book', () => {
    const data = { b1: { status: 'done', page: 300, startedAt: '2025-01-01' } };
    expect(getBookState(data, 'b1')).toEqual({ status: 'done', page: 300, startedAt: '2025-01-01' });
  });
});

const readingDom = `
  <span id="reading-done-count">0</span>
  <span id="reading-total-count">0</span>
  <div id="reading-progress-fill"></div>
  <div id="reading-books"></div>
  <input id="reading-add-title" value="Новая книга" />
  <input id="reading-add-author" value="Автор" />
  <input id="reading-add-type" value="сборник" />
`;

describe('Reading — addBook()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = readingDom;
  });

  test('adds book with correct structure', () => {
    addBook();
    const books = loadReadingBooks();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Новая книга');
    expect(books[0].author).toBe('Автор');
    expect(books[0].type).toBe('сборник');
    expect(books[0].id).toMatch(/^book-/);
  });

  test('clears input fields after adding', () => {
    addBook();
    expect(document.getElementById('reading-add-title').value).toBe('');
    expect(document.getElementById('reading-add-author').value).toBe('');
  });

  test('does nothing with empty title', () => {
    document.getElementById('reading-add-title').value = '   ';
    addBook();
    expect(loadReadingBooks()).toHaveLength(0);
  });

  test('defaults type to "роман"', () => {
    document.getElementById('reading-add-type').value = '';
    addBook();
    expect(loadReadingBooks()[0].type).toBe('роман');
  });
});

describe('Reading — removeBook()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = readingDom;
    global.confirm = jest.fn(() => true);
    saveReadingBooks([
      { id: 'b1', title: 'Keep', author: 'A', type: 'роман' },
      { id: 'b2', title: 'Remove', author: 'B', type: 'роман' },
    ]);
    saveReading({ b1: { status: 'reading', page: 10 }, b2: { status: 'waiting', page: 0 } });
  });

  test('removes book and its reading progress', () => {
    removeBook('b2');
    expect(loadReadingBooks()).toHaveLength(1);
    expect(loadReadingBooks()[0].id).toBe('b1');
    expect(loadReading().b2).toBeUndefined();
  });

  test('does nothing if user cancels', () => {
    global.confirm = jest.fn(() => false);
    removeBook('b1');
    expect(loadReadingBooks()).toHaveLength(2);
  });
});

describe('Reading — toggleBookExpand()', () => {
  beforeEach(() => {
    document.body.innerHTML = readingDom;
  });

  test('toggles expand state', () => {
    toggleBookExpand('b1');
    expect(expandedBooks.b1).toBe(true);

    toggleBookExpand('b1');
    expect(expandedBooks.b1).toBe(false);
  });
});

describe('Reading — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'reading');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
  });
});
