const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
  loadWidget('stickers.js');
  applyWidgetConfigSync();
});

describe('Stickers — load / save', () => {
  test('loadStickers returns empty array when no data', () => {
    expect(loadStickers()).toEqual([]);
  });

  test('saveStickers / loadStickers roundtrip', () => {
    const stickers = [{ id: 'a', text: 'Note', done: false, color: '#f59e0b' }];
    saveStickers(stickers);
    expect(loadStickers()).toEqual(stickers);
  });
});

describe('Stickers — addSticker()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<input id="sticker-input" value="Test note" />';
  });

  test('adds sticker with correct structure', () => {
    addSticker();
    const stickers = loadStickers();
    expect(stickers).toHaveLength(1);
    expect(stickers[0].text).toBe('Test note');
    expect(stickers[0].done).toBe(false);
    expect(stickers[0].color).toBeTruthy();
    expect(stickers[0].createdAt).toBeTruthy();
  });

  test('clears input after adding', () => {
    addSticker();
    expect(document.getElementById('sticker-input').value).toBe('');
  });

  test('does nothing with empty input', () => {
    document.getElementById('sticker-input').value = '   ';
    addSticker();
    expect(loadStickers()).toHaveLength(0);
  });

  test('cycles through colors', () => {
    for (let i = 0; i < 7; i++) {
      document.getElementById('sticker-input').value = `Note ${i}`;
      addSticker();
    }
    const stickers = loadStickers();
    expect(stickers).toHaveLength(7);
    // Color 7 should cycle back to color 1
    expect(stickers[6].color).toBe(stickers[0].color);
  });
});

describe('Stickers — toggleSticker()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<input id="sticker-input" value="Toggle me" />';
    addSticker();
  });

  test('toggles done status', () => {
    const id = loadStickers()[0].id;
    toggleSticker(id);
    expect(loadStickers()[0].done).toBe(true);

    toggleSticker(id);
    expect(loadStickers()[0].done).toBe(false);
  });
});

describe('Stickers — deleteSticker()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<input id="sticker-input" />';
    document.getElementById('sticker-input').value = 'Keep';
    addSticker();
    document.getElementById('sticker-input').value = 'Delete';
    addSticker();
  });

  test('removes sticker by id', () => {
    const stickers = loadStickers();
    deleteSticker(stickers[1].id);
    expect(loadStickers()).toHaveLength(1);
    expect(loadStickers()[0].text).toBe('Keep');
  });
});

describe('Stickers — changeStickerColor()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<input id="sticker-input" value="Colorful" />';
    addSticker();
  });

  test('cycles to next color', () => {
    const id = loadStickers()[0].id;
    const originalColor = loadStickers()[0].color;
    changeStickerColor(id);
    const newColor = loadStickers()[0].color;
    expect(newColor).not.toBe(originalColor);
  });
});

describe('Stickers — renderStickers()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sticker-board"></div><input id="sticker-input" />';
  });

  test('shows empty message when no stickers', () => {
    renderStickers();
    expect(document.getElementById('sticker-board').textContent).toContain('Доска пуста');
  });

  test('renders sticker notes', () => {
    document.getElementById('sticker-input').value = 'Visible note';
    addSticker();
    renderStickers();
    const board = document.getElementById('sticker-board');
    expect(board.querySelectorAll('.sticker-note').length).toBe(1);
    expect(board.textContent).toContain('Visible note');
  });
});

describe('Stickers — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'stickers');
    expect(widget).toBeTruthy();
    expect(widget.label).toBe('Доска напоминаний');
    expect(widget.zone).toBe('grid');
    expect(widget.render).toBe(renderStickers);
    expect(widget.init).toBe(initStickers);
  });
});
