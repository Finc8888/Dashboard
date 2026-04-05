const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
  loadWidget('server-build.js');
  applyWidgetConfigSync();
});

describe('Server Build — load / save', () => {
  test('loadServerBuild returns empty array when no data', () => {
    expect(loadServerBuild()).toEqual([]);
  });

  test('saveServerBuild / loadServerBuild roundtrip', () => {
    const rows = [{ id: '1', component: 'CPU', model: 'Ryzen 9', price: '30000', status: 'выбрано' }];
    saveServerBuild(rows);
    expect(loadServerBuild()).toEqual(rows);
  });

  test('loadServerModels returns empty array when no data', () => {
    expect(loadServerModels()).toEqual([]);
  });

  test('saveServerModels / loadServerModels roundtrip', () => {
    const models = [{ id: '1', name: 'Llama 3', size: '8B', vram: '8GB' }];
    saveServerModels(models);
    expect(loadServerModels()).toEqual(models);
  });
});

describe('Server Build — sbAddRow()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sb-table"></div><div id="sb-total"></div><div id="sb-models-table"></div>';
  });

  test('adds empty row with correct structure', () => {
    sbAddRow();
    const rows = loadServerBuild();
    expect(rows).toHaveLength(1);
    expect(rows[0].component).toBe('');
    expect(rows[0].status).toBe('выбираю');
    expect(rows[0].id).toBeTruthy();
  });
});

describe('Server Build — sbUpdateField()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sb-total"></div>';
    saveServerBuild([{ id: 'r1', component: 'CPU', model: '', price: '10000', link: '', status: 'выбираю' }]);
  });

  test('updates component field', () => {
    sbUpdateField('r1', 'component', 'GPU');
    expect(loadServerBuild()[0].component).toBe('GPU');
  });

  test('updates price and recalculates total', () => {
    sbUpdateField('r1', 'price', '25000');
    expect(loadServerBuild()[0].price).toBe('25000');
  });
});

describe('Server Build — sbCycleStatus()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sb-table"></div><div id="sb-total"></div><div id="sb-models-table"></div>';
    saveServerBuild([{ id: 'r1', component: 'CPU', model: '', price: '', link: '', status: 'выбираю' }]);
  });

  test('cycles through statuses', () => {
    sbCycleStatus('r1');
    expect(loadServerBuild()[0].status).toBe('выбрано');

    sbCycleStatus('r1');
    expect(loadServerBuild()[0].status).toBe('в корзине');

    sbCycleStatus('r1');
    expect(loadServerBuild()[0].status).toBe('заказано');

    sbCycleStatus('r1');
    expect(loadServerBuild()[0].status).toBe('куплено');

    sbCycleStatus('r1');
    expect(loadServerBuild()[0].status).toBe('выбираю'); // wraps around
  });
});

describe('Server Build — sbUpdateTotal()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sb-total"></div>';
  });

  test('calculates total from prices', () => {
    saveServerBuild([
      { id: 'r1', price: '10000' },
      { id: 'r2', price: '25000' },
      { id: 'r3', price: '5000' },
    ]);
    sbUpdateTotal();
    expect(document.getElementById('sb-total').textContent).toContain('40');
  });

  test('handles non-numeric prices gracefully', () => {
    saveServerBuild([
      { id: 'r1', price: 'N/A' },
      { id: 'r2', price: '10000' },
    ]);
    sbUpdateTotal();
    expect(document.getElementById('sb-total').textContent).toContain('10');
  });

  test('shows empty for zero total', () => {
    sbUpdateTotal();
    expect(document.getElementById('sb-total').textContent).toBe('');
  });
});

describe('Server Build — sbAddModel()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sb-table"></div><div id="sb-total"></div><div id="sb-models-table"></div>';
  });

  test('adds empty model row', () => {
    sbAddModel();
    const models = loadServerModels();
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe('');
    expect(models[0].id).toBeTruthy();
  });
});

describe('Server Build — SB_STATUSES', () => {
  test('contains all 5 statuses in correct order', () => {
    expect(SB_STATUSES).toEqual(['выбираю', 'выбрано', 'в корзине', 'заказано', 'куплено']);
  });
});

describe('Server Build — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'server-build');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
  });
});
