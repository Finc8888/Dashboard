const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.renderProdStats = jest.fn();
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('goals.js');
  applyWidgetConfigSync();
});

describe('Goals — storage', () => {
  test('loadGoalsStore returns empty object when no data', () => {
    expect(loadGoalsStore('prod_monthly_goals_v2')).toEqual({});
  });

  test('saveGoalsStore / loadGoalsStore roundtrip', () => {
    const data = { '2025-04': [{ id: '1', text: 'Goal' }] };
    saveGoalsStore('prod_monthly_goals_v2', data);
    expect(loadGoalsStore('prod_monthly_goals_v2')).toEqual(data);
  });

  test('getGoalsForPeriod returns empty array for missing period', () => {
    expect(getGoalsForPeriod('prod_monthly_goals_v2', '2099-01')).toEqual([]);
  });

  test('setGoalsForPeriod saves and retrieves', () => {
    const goals = [{ id: '1', text: 'Learn Go', done: false }];
    setGoalsForPeriod('prod_monthly_goals_v2', '2025-04', goals);
    expect(getGoalsForPeriod('prod_monthly_goals_v2', '2025-04')).toEqual(goals);
  });
});

describe('Goals — currentMonthKey / currentYearKey', () => {
  test('currentMonthKey returns YYYY-MM format', () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });

  test('currentYearKey returns YYYY format', () => {
    expect(currentYearKey()).toMatch(/^\d{4}$/);
  });
});

describe('Goals — addGoal()', () => {
  beforeEach(() => localStorage.clear());

  test('adds goal with correct structure', () => {
    addGoal('prod_monthly_goals_v2', '2025-04', 'New goal');
    const goals = getGoalsForPeriod('prod_monthly_goals_v2', '2025-04');
    expect(goals).toHaveLength(1);
    expect(goals[0].text).toBe('New goal');
    expect(goals[0].icon).toBe('🎯');
    expect(goals[0].done).toBe(false);
    expect(goals[0].id).toBeTruthy();
  });
});

describe('Goals — carryOverGoals()', () => {
  beforeEach(() => localStorage.clear());

  test('carries incomplete goals to new period', () => {
    setGoalsForPeriod('prod_monthly_goals_v2', '2025-03', [
      { id: '1', text: 'Undone', done: false },
      { id: '2', text: 'Done', done: true },
    ]);

    carryOverGoals('prod_monthly_goals_v2', '2025-04');

    const carried = getGoalsForPeriod('prod_monthly_goals_v2', '2025-04');
    expect(carried).toHaveLength(1);
    expect(carried[0].text).toBe('Undone');
    expect(carried[0].done).toBe(false);
    expect(carried[0].carriedFrom).toBe('2025-03');
  });

  test('carries recurring goals even if done', () => {
    setGoalsForPeriod('prod_monthly_goals_v2', '2025-03', [
      { id: '1', text: 'Recurring', done: true, recurring: 'early-start' },
      { id: '2', text: 'Done normal', done: true },
    ]);

    carryOverGoals('prod_monthly_goals_v2', '2025-04');

    const carried = getGoalsForPeriod('prod_monthly_goals_v2', '2025-04');
    expect(carried).toHaveLength(1);
    expect(carried[0].text).toBe('Recurring');
    expect(carried[0].done).toBe(false); // reset
  });

  test('does not carry if target period already has goals', () => {
    setGoalsForPeriod('prod_monthly_goals_v2', '2025-03', [
      { id: '1', text: 'Old', done: false },
    ]);
    setGoalsForPeriod('prod_monthly_goals_v2', '2025-04', [
      { id: '2', text: 'Existing', done: false },
    ]);

    carryOverGoals('prod_monthly_goals_v2', '2025-04');

    const goals = getGoalsForPeriod('prod_monthly_goals_v2', '2025-04');
    expect(goals).toHaveLength(1);
    expect(goals[0].text).toBe('Existing');
  });

  test('does nothing if no previous period exists', () => {
    carryOverGoals('prod_monthly_goals_v2', '2025-01');
    expect(getGoalsForPeriod('prod_monthly_goals_v2', '2025-01')).toEqual([]);
  });
});

describe('Goals — registration', () => {
  test('registers monthly-goals widget', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'monthly-goals');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
  });

  test('registers yearly-goals widget', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'yearly-goals');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
  });
});
