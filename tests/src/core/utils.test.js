const { loadCore } = require('../helpers');

beforeAll(() => { loadCore(); });

describe('todayStr()', () => {
  test('returns YYYY-MM-DD format', () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('returns today date', () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(todayStr()).toBe(expected);
  });
});

describe('fmtDate()', () => {
  test('formats ISO date to ru-RU locale', () => {
    const result = fmtDate('2025-03-15T10:30:00.000Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('fmtDuration()', () => {
  test('returns "< 1 min" for very short durations', () => {
    expect(fmtDuration(20000)).toBe('< 1 мин');
  });

  test('returns minutes for < 60 min', () => {
    expect(fmtDuration(5 * 60000)).toBe('5 мин');
    expect(fmtDuration(45 * 60000)).toBe('45 мин');
  });

  test('returns hours and minutes', () => {
    expect(fmtDuration(90 * 60000)).toBe('1ч 30мин');
    expect(fmtDuration(125 * 60000)).toBe('2ч 5мин');
  });

  test('returns only hours when no remainder', () => {
    expect(fmtDuration(120 * 60000)).toBe('2ч');
    expect(fmtDuration(60 * 60000)).toBe('1ч');
  });
});

describe('uid()', () => {
  test('returns a non-empty string', () => {
    const id = uid();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

describe('timeToMinutes()', () => {
  test('converts HH:MM to minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('07:30')).toBe(450);
    expect(timeToMinutes('12:00')).toBe(720);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('escHtml()', () => {
  test('escapes HTML special characters', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
    expect(escHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(escHtml('a & b')).toBe('a &amp; b');
  });

  test('leaves safe strings unchanged', () => {
    expect(escHtml('hello world')).toBe('hello world');
  });

  test('handles all special chars together', () => {
    expect(escHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('showToast()', () => {
  test('creates a toast element in document body', () => {
    showToast('Test message');
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Test message');
  });

  test('creates toast in specified container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showToast('In container', container);
    expect(container.querySelector('.toast')).not.toBeNull();
  });
});
