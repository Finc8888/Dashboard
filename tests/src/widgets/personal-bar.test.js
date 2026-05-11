const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
  loadWidget('personal-bar.js');
  applyWidgetConfigSync();
});

const personalBarDom = `
  <span id="days-counter"></span>
  <span id="days-since-label"></span>
  <div id="days-fail-badges"></div>
  <span id="cushion-count"></span>
  <span id="mort-payment"></span>
  <span id="mort-debt"></span>
  <span id="mort-rate"></span>
  <span id="mort-dates"></span>
  <span id="mort-payday"></span>
  <div id="mortgage-edit-panel" style="display:none"></div>
  <div id="mortgage-display"></div>
  <button id="mortgage-edit-btn"></button>
  <input id="mort-input-payment" />
  <input id="mort-input-debt" />
  <input id="mort-input-rate" />
  <input id="mort-input-start" />
  <input id="mort-input-end" />
  <input id="mort-input-payday" />
`;

describe('Personal Bar — Days Counter', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = personalBarDom;
  });

  test('loadDaysData returns null when no data', () => {
    expect(loadDaysData()).toBeNull();
  });

  test('saveDaysData / loadDaysData roundtrip', () => {
    const data = { startDate: '2025-01-01', failCount: 0 };
    saveDaysData(data);
    expect(loadDaysData()).toEqual(data);
  });

  test('renderDaysCounter shows dash when no data and no defaults', () => {
    renderDaysCounter();
    expect(document.getElementById('days-counter').textContent).toBe('—');
  });

  test('renderDaysCounter shows days count', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 5);
    const dateStr = yesterday.toISOString().slice(0, 10);
    saveDaysData({ startDate: dateStr, failCount: 0 });
    renderDaysCounter();
    expect(document.getElementById('days-counter').textContent).toBe('5');
  });

  test('resetDaysCounter increments failCount', () => {
    saveDaysData({ startDate: '2025-01-01', failCount: 0 });
    global.confirm = jest.fn(() => true);
    resetDaysCounter();
    const data = loadDaysData();
    expect(data.failCount).toBe(1);
    expect(data.startDate).toBe(new Date().toISOString().slice(0, 10));
  });

  test('resetDaysCounter does nothing if user cancels', () => {
    saveDaysData({ startDate: '2025-01-01', failCount: 0 });
    global.confirm = jest.fn(() => false);
    resetDaysCounter();
    expect(loadDaysData().failCount).toBe(0);
  });
});

describe('Personal Bar — Cushions', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = personalBarDom;
  });

  test('getCushions returns 0 when no data', () => {
    expect(getCushions()).toBe(0);
  });

  test('changeCushions increments', () => {
    changeCushions(1);
    expect(getCushions()).toBe(1);
    expect(document.getElementById('cushion-count').textContent).toBe('1');
  });

  test('changeCushions does not go below 0', () => {
    changeCushions(-1);
    expect(getCushions()).toBe(0);
  });
});

describe('Personal Bar — Mortgage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = personalBarDom;
  });

  test('loadMortgage returns empty object when no data', () => {
    expect(loadMortgage()).toEqual({});
  });

  test('saveMortgage saves and renders', () => {
    document.getElementById('mort-input-payment').value = '50000';
    document.getElementById('mort-input-debt').value = '3000000';
    document.getElementById('mort-input-rate').value = '12';
    document.getElementById('mort-input-start').value = '2024-01-01';
    document.getElementById('mort-input-end').value = '2044-01-01';
    document.getElementById('mort-input-payday').value = '15';
    // Open edit panel first
    document.getElementById('mortgage-edit-panel').style.display = '';
    document.getElementById('mortgage-display').style.display = 'none';

    saveMortgage();

    const data = loadMortgage();
    expect(data.payment).toBe(50000);
    expect(data.debt).toBe(3000000);
    expect(data.rate).toBe(12);
    expect(data.payDay).toBe(15);
    expect(document.getElementById('mort-payment').textContent).toContain('50');
  });

  test('renderMortgage shows dash when no data', () => {
    renderMortgage();
    expect(document.getElementById('mort-dates').textContent).toBe('—');
    expect(document.getElementById('mort-payday').textContent).toBe('—');
  });
});

describe('Personal Bar — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'personal-bar');
    expect(widget).toBeTruthy();
  });
});
