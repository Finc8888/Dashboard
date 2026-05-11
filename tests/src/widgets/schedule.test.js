const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.sendNotification = jest.fn();
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('schedule.js');
  applyWidgetConfigSync();
});

describe('Schedule — slots', () => {
  test('has 16 time slots defined', () => {
    expect(slots).toHaveLength(16);
  });

  test('each slot has time, end, and dot', () => {
    slots.forEach(slot => {
      expect(slot.time).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.end).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.dot).toBeTruthy();
    });
  });

  test('slots are in chronological order', () => {
    for (let i = 1; i < slots.length; i++) {
      expect(timeToMinutes(slots[i].time)).toBeGreaterThanOrEqual(timeToMinutes(slots[i - 1].time));
    }
  });
});

describe('Schedule — labels storage', () => {
  test('loadScheduleLabels returns null when no data', () => {
    expect(loadScheduleLabels()).toBeNull();
  });

  test('saveScheduleLabels / loadScheduleLabels roundtrip', () => {
    const labels = { 0: { label: 'Wake up', sub: 'routine' } };
    saveScheduleLabels(labels);
    expect(loadScheduleLabels()).toEqual(labels);
  });
});

describe('Schedule — getSlotLabel()', () => {
  beforeEach(() => localStorage.clear());

  test('returns user-defined label when set', () => {
    saveScheduleLabels({ 3: { label: 'Custom', sub: 'details' } });
    expect(getSlotLabel(3)).toBe('Custom');
  });

  test('returns default label when no custom label', () => {
    const label = getSlotLabel(99);
    expect(label).toContain('Окно расписания');
  });
});

describe('Schedule — getSlotSub()', () => {
  beforeEach(() => localStorage.clear());

  test('returns user-defined sub when set', () => {
    saveScheduleLabels({ 5: { label: 'Lunch', sub: 'take a break' } });
    expect(getSlotSub(5)).toBe('take a break');
  });

  test('returns empty string when no sub', () => {
    expect(getSlotSub(99)).toBe('');
  });
});

describe('Schedule — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'schedule');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('grid');
    expect(widget.init).toBe(initSchedule);
  });
});
