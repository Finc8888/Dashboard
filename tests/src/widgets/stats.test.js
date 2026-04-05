const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  global.renderAllGoals = jest.fn();
  // goals.js is a dependency for stats (carryOverGoals, etc.)
  loadCore();
  loadWidget('goals.js');
  loadWidget('stats.js');
  applyWidgetConfigSync();
});

describe('Stats — getStat()', () => {
  test('returns 0 when no data', () => {
    expect(getStat('go')).toBe(0);
    expect(getStat('tasks')).toBe(0);
    expect(getStat('duo')).toBe(0);
  });

  test('returns stored value', () => {
    localStorage.setItem('prod_stat_go', '15');
    expect(getStat('go')).toBe(15);
  });
});

describe('Stats — Early Start', () => {
  beforeEach(() => localStorage.clear());

  test('loadEarlyData returns empty object when no data', () => {
    expect(loadEarlyData()).toEqual({});
  });

  test('saveEarlyData / loadEarlyData roundtrip', () => {
    const data = { '2025-04': { '2025-04-04': { time: 'T07:15', success: true } } };
    saveEarlyData(data);
    expect(loadEarlyData()).toEqual(data);
  });

  test('getEarlyCount returns count for month', () => {
    const mk = currentMonthKey();
    saveEarlyData({
      [mk]: {
        '2025-04-01': { success: true },
        '2025-04-02': { success: true },
        '2025-04-03': { success: false },
      }
    });
    // success: true count = 2
    expect(getEarlyCount(mk)).toBe(2);
  });

  test('getEarlyCount returns 0 for empty month', () => {
    expect(getEarlyCount('2099-01')).toBe(0);
  });
});

describe('Stats — getDaysInMonth()', () => {
  test('returns correct days for known months', () => {
    expect(getDaysInMonth('2025-01')).toBe(31);
    expect(getDaysInMonth('2025-02')).toBe(28);
    expect(getDaysInMonth('2024-02')).toBe(29); // leap year
    expect(getDaysInMonth('2025-04')).toBe(30);
  });
});

describe('Stats — Distraction Log', () => {
  beforeEach(() => localStorage.clear());

  test('loadDistractions returns empty object', () => {
    expect(loadDistractions()).toEqual({});
  });

  test('saveDistractions / loadDistractions roundtrip', () => {
    const data = { '2025-04-04': [{ category: 'youtube', time: 'T10:00' }] };
    saveDistractions(data);
    expect(loadDistractions()).toEqual(data);
  });
});

describe('Stats — renderStats()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="stat-early">0</div>
      <div id="stat-early-label">Ранний старт</div>
      <div id="stat-early-sub"></div>
      <div id="stat-distraction-count">0</div>
      <div id="distraction-weekly"></div>
    `;
  });

  test('renders early start count', () => {
    const mk = currentMonthKey();
    saveEarlyData({ [mk]: { '2025-04-01': { success: true } } });
    renderStats();
    expect(document.getElementById('stat-early').textContent).toBe('1');
  });

  test('renders distraction count', () => {
    const today = localDateStr(new Date());
    saveDistractions({ [today]: [{ category: 'youtube' }, { category: 'social' }] });
    renderStats();
    expect(document.getElementById('stat-distraction-count').textContent).toBe('2');
  });
});

describe('Stats — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'stats');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
    expect(widget.render).toBe(renderStats);
    expect(widget.init).toBe(initStats);
  });
});
