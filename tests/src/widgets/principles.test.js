const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
  loadWidget('principles.js');
  applyWidgetConfigSync();
});

describe('Principles — load / save', () => {
  test('loadPrinciples returns null when no data', () => {
    expect(loadPrinciples()).toBeNull();
  });

  test('savePrinciples / loadPrinciples roundtrip', () => {
    const list = [{ id: '1', icon: '🎯', title: 'DRY', desc: 'Do not repeat', color: 'red' }];
    savePrinciples(list);
    expect(loadPrinciples()).toEqual(list);
  });
});

describe('Principles — getPrinciples()', () => {
  test('returns defaults from config when no saved data', () => {
    localStorage.clear();
    const result = getPrinciples();
    expect(result.length).toBe(5);
    expect(result[0].id).toBe('p1');
  });

  test('returns saved principles when available', () => {
    const list = [{ id: '1', icon: '🔥', title: 'Test', desc: 'Desc', color: 'blue' }];
    savePrinciples(list);
    expect(getPrinciples()).toEqual(list);
  });
});

describe('Principles — renderPrinciples()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="principles-list"></div>';
  });

  test('renders defaults when no saved principles', () => {
    renderPrinciples();
    const list = document.getElementById('principles-list');
    expect(list.querySelectorAll('.principle').length).toBe(5);
  });

  test('renders principle items', () => {
    savePrinciples([
      { id: '1', icon: '🎯', title: 'Focus', desc: 'Stay focused', color: 'red' },
    ]);
    renderPrinciples();
    const list = document.getElementById('principles-list');
    expect(list.querySelectorAll('.principle').length).toBe(1);
    expect(list.textContent).toContain('Focus');
    expect(list.textContent).toContain('Stay focused');
  });

  test('escapes HTML in principle text', () => {
    savePrinciples([
      { id: '1', icon: '!', title: '<script>alert(1)</script>', desc: 'safe', color: 'red' },
    ]);
    renderPrinciples();
    const list = document.getElementById('principles-list');
    expect(list.innerHTML).not.toContain('<script>');
    expect(list.innerHTML).toContain('&lt;script&gt;');
  });
});

describe('Principles — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'principles');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('grid');
    expect(widget.render).toBe(renderPrinciples);
  });
});
