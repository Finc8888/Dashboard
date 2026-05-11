const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.TRAINING_SCHEDULE = [];
  global.TRAINING_PLAN_META = { totalWeeks: 12, currentRecord: '25:00', finalTarget: '22:00', phases: [] };
  global.RECORDS_DATA = [];
  global.initTrainingData = jest.fn(() => Promise.resolve());
  loadCore();
  loadWidget('running.js');
  applyWidgetConfigSync();
});

const runningDom = `
  <div id="training-today"></div>
  <div id="running-grid"></div>
`;

describe('Running — load / save', () => {
  beforeEach(() => { localStorage.clear(); });

  test('loadRunning returns empty object when no data', () => {
    expect(loadRunning()).toEqual({});
  });

  test('saveRunning / loadRunning roundtrip', () => {
    const data = { '5km': [{ secs: 1500, date: '2025-01-01' }] };
    saveRunning(data);
    expect(loadRunning()).toEqual(data);
  });
});

describe('Running — parseRunTime()', () => {
  test('parses mm:ss format', () => {
    expect(parseRunTime('25:30')).toBe(25 * 60 + 30);
  });

  test('parses hh:mm:ss format', () => {
    expect(parseRunTime('1:25:30')).toBe(3600 + 25 * 60 + 30);
  });

  test('returns null for invalid input', () => {
    expect(parseRunTime('abc')).toBeNull();
  });
});

describe('Running — fmtRunTime()', () => {
  test('formats minutes and seconds', () => {
    expect(fmtRunTime(1530)).toBe('25:30');
  });

  test('formats hours', () => {
    expect(fmtRunTime(5130)).toBe('1:25:30');
  });
});

describe('Running — calcPace()', () => {
  test('calculates pace per km', () => {
    const pace = calcPace(1500, 5);
    expect(pace).toBe('5:00');
  });
});

describe('Running — submitRunResult()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = runningDom;
    renderRunning();
  });

  test('adds result and renders', () => {
    document.getElementById('run-input-5km').value = '25:30';
    document.getElementById('run-date-5km').value = '2025-06-01';
    submitRunResult('5km');
    const data = loadRunning();
    expect(data['5km']).toHaveLength(1);
    expect(data['5km'][0].secs).toBe(1530);
  });

  test('rejects invalid time', () => {
    document.getElementById('run-input-5km').value = 'abc';
    submitRunResult('5km');
    expect(loadRunning()['5km']).toBeUndefined();
  });
});

describe('Running — deleteRunResult()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = runningDom;
  });

  test('removes result by index', () => {
    saveRunning({ '5km': [{ secs: 1500 }, { secs: 1600 }] });
    renderRunning();
    deleteRunResult('5km', 1);
    expect(loadRunning()['5km']).toHaveLength(1);
  });
});

describe('Running — saveEditRun()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = runningDom;
  });

  test('edits result and re-sorts', () => {
    saveRunning({ '5km': [{ secs: 1500, date: '2025-01-01' }, { secs: 1600, date: '2025-02-01' }] });
    startEditRun('5km', 1);
    document.getElementById('run-edit-time').value = '24:00';
    document.getElementById('run-edit-date').value = '2025-03-01';
    saveEditRun('5km', 1);
    const results = loadRunning()['5km'];
    expect(results[0].secs).toBe(1440); // 24:00 is now the best
    expect(results[1].secs).toBe(1500);
  });
});

describe('Running — renderRunning()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = runningDom;
  });

  test('renders all distance cards', () => {
    renderRunning();
    const cards = document.querySelectorAll('.run-card');
    expect(cards.length).toBe(4); // 5km, 10km, half, marathon
  });

  test('shows best result', () => {
    saveRunning({ '5km': [{ secs: 1500, date: '2025-01-01' }] });
    renderRunning();
    expect(document.getElementById('running-grid').textContent).toContain('25:00');
  });
});

describe('Running — registration', () => {
  test('registers with correct id', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'running');
    expect(widget).toBeTruthy();
  });
});
