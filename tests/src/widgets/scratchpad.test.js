const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.addTask = jest.fn();
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('scratchpad.js');
  applyWidgetConfigSync();
});

describe('Scratchpad — load / save', () => {
  test('loadScratchpad returns empty object when no data', () => {
    expect(loadScratchpad()).toEqual({});
  });

  test('saveScratchpad / loadScratchpad roundtrip', () => {
    const data = { text: 'My notes', date: '2025-04-04', history: {} };
    saveScratchpad(data);
    expect(loadScratchpad()).toEqual(data);
  });
});

describe('Scratchpad — scratchpadToTask()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<textarea id="scratchpad-textarea">First line\nSecond line</textarea>';
    global.addTask = jest.fn();
  });

  test('creates task from first line', () => {
    scratchpadToTask();
    expect(global.addTask).toHaveBeenCalledWith('First line');
  });

  test('clears textarea after creating task', () => {
    scratchpadToTask();
    expect(document.getElementById('scratchpad-textarea').value).toBe('');
  });

  test('saves empty text to scratchpad data', () => {
    scratchpadToTask();
    expect(loadScratchpad().text).toBe('');
  });

  test('does nothing with empty textarea', () => {
    document.getElementById('scratchpad-textarea').value = '   ';
    scratchpadToTask();
    expect(global.addTask).not.toHaveBeenCalled();
  });
});

describe('Scratchpad — toggleScratchpadHistory()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="scratchpad-history" style="display:none"></div>';
  });

  test('opens history panel', () => {
    toggleScratchpadHistory();
    expect(document.getElementById('scratchpad-history').style.display).not.toBe('none');
  });

  test('toggles panel closed', () => {
    const panel = document.getElementById('scratchpad-history');
    panel.style.display = '';
    toggleScratchpadHistory();
    expect(panel.style.display).toBe('none');
  });

  test('shows empty message when no history', () => {
    toggleScratchpadHistory();
    expect(document.getElementById('scratchpad-history').textContent).toContain('Пока пусто');
  });

  test('renders history entries', () => {
    saveScratchpad({
      text: '', date: '2025-04-04',
      history: { '2025-04-03': 'Yesterday notes', '2025-04-02': 'Day before' }
    });
    toggleScratchpadHistory();
    const panel = document.getElementById('scratchpad-history');
    expect(panel.querySelectorAll('.scratchpad-history-day').length).toBe(2);
    expect(panel.textContent).toContain('Yesterday notes');
  });
});

describe('Scratchpad — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'scratchpad');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
  });
});
