/**
 * Integration test: loads ALL widget files and verifies each registers correctly.
 */
const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');
const fs = require('fs');
const path = require('path');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.renderProdStats = jest.fn();
  global.sendNotification = jest.fn();
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  global.renderAllGoals = jest.fn();
  global.addTask = jest.fn();

  loadCore();

  // Load ALL widget files
  const { WWW } = require('../helpers');
  const widgetsDir = path.resolve(WWW, 'widgets');
  const files = fs.readdirSync(widgetsDir).filter(f => f.endsWith('.js')).sort();
  // Load goals before stats (dependency)
  const ordered = ['goals.js', ...files.filter(f => f !== 'goals.js')];
  ordered.forEach(f => loadWidget(f));

  // Apply widget config (label, zone, storageKeys from widgets-config.json)
  applyWidgetConfigSync();
});

describe('All widgets register correctly', () => {
  const expectedWidgets = [
    { id: 'quote', zone: 'top' },
    { id: 'personal-bar', zone: 'top' },
    { id: 'running', zone: 'top' },
    { id: 'schedule', zone: 'grid' },
    { id: 'todo', zone: 'grid' },
    { id: 'stickers', zone: 'grid' },
    { id: 'weekend-plan', zone: 'grid' },
    { id: 'principles', zone: 'grid' },
    { id: 'key-skills', zone: 'grid' },
    { id: 'monthly-goals', zone: 'full-width' },
    { id: 'yearly-goals', zone: 'full-width' },
    { id: 'stats', zone: 'full-width' },
    { id: 'reading', zone: 'full-width' },
    { id: 'productivity', zone: 'full-width' },
    { id: 'go-roadmap', zone: 'full-width' },
    { id: 'scratchpad', zone: 'full-width' },
    { id: 'server-build', zone: 'full-width' },
    { id: 'ai-assistant', zone: 'full-width' },
  ];

  test('registry has at least 18 widgets', () => {
    expect(window.WidgetRegistry.length).toBeGreaterThanOrEqual(18);
  });

  expectedWidgets.forEach(({ id, zone }) => {
    test(`widget "${id}" is registered with zone "${zone}"`, () => {
      const widget = window.WidgetRegistry.find(w => w.id === id);
      expect(widget).toBeTruthy();
      expect(widget.id).toBe(id);
      expect(widget.label).toBeTruthy();
      expect(widget.zone).toBe(zone);
    });
  });

  test('all widgets have unique IDs', () => {
    const ids = window.WidgetRegistry.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all widgets have a label', () => {
    window.WidgetRegistry.forEach(w => {
      expect(w.label).toBeTruthy();
    });
  });

  test('all widgets have a valid zone', () => {
    const validZones = ['top', 'grid', 'full-width'];
    window.WidgetRegistry.forEach(w => {
      expect(validZones).toContain(w.zone);
    });
  });
});
