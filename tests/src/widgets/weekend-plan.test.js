const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('weekend-plan.js');
  applyWidgetConfigSync();
});

describe('Weekend Plan — load / save', () => {
  test('loadWpTasks returns empty array when no data', () => {
    expect(loadWpTasks()).toEqual([]);
  });

  test('saveWpTasks / loadWpTasks roundtrip', () => {
    const tasks = [{ id: 'w1', text: 'Relax', done: false }];
    saveWpTasks(tasks);
    expect(loadWpTasks()).toEqual(tasks);
  });
});

describe('Weekend Plan — addWpTask()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="wp-list"></div>';
  });

  test('adds task with correct structure', () => {
    addWpTask('Chill');
    const tasks = loadWpTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Chill');
    expect(tasks[0].done).toBe(false);
    expect(tasks[0].id).toBeTruthy();
  });
});

describe('Weekend Plan — toggleWpTask()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="wp-list"></div>';
    saveWpTasks([{ id: 'w1', text: 'Test', done: false }]);
  });

  test('toggles done status', () => {
    toggleWpTask('w1');
    expect(loadWpTasks()[0].done).toBe(true);

    toggleWpTask('w1');
    expect(loadWpTasks()[0].done).toBe(false);
  });
});

describe('Weekend Plan — deleteWpTask()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="wp-list"></div>';
    saveWpTasks([
      { id: 'w1', text: 'Keep', done: false },
      { id: 'w2', text: 'Delete', done: false },
    ]);
  });

  test('removes task by id', () => {
    deleteWpTask('w2');
    const remaining = loadWpTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('Keep');
  });
});

describe('Weekend Plan — renderWeekendPlan()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="wp-list"></div>';
  });

  test('renders empty message when no tasks', () => {
    renderWeekendPlan();
    expect(document.getElementById('wp-list').textContent).toContain('Планов пока нет');
  });

  test('renders task items', () => {
    saveWpTasks([{ id: 'w1', text: 'Go hiking', done: false, addedAt: new Date().toISOString() }]);
    renderWeekendPlan();
    const list = document.getElementById('wp-list');
    expect(list.querySelectorAll('.wp-item').length).toBe(1);
    expect(list.textContent).toContain('Go hiking');
  });
});

describe('Weekend Plan — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'weekend-plan');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('grid');
    expect(widget.render).toBe(renderWeekendPlan);
    expect(widget.init).toBe(initWeekendPlanListeners);
  });
});
