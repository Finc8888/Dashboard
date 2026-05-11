const { loadCore, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  // Mock getCurrentUser for widget-manager
  global.getCurrentUser = jest.fn(() => ({ username: 'testuser', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
});

describe('registerWidget()', () => {
  beforeEach(() => {
    window.WidgetRegistry = [];
  });

  test('adds widget to registry', () => {
    registerWidget({ id: 'test', label: 'Test', zone: 'grid' });
    expect(window.WidgetRegistry).toHaveLength(1);
    expect(window.WidgetRegistry[0].id).toBe('test');
  });

  test('multiple widgets register correctly', () => {
    registerWidget({ id: 'a', label: 'A', zone: 'top' });
    registerWidget({ id: 'b', label: 'B', zone: 'grid' });
    registerWidget({ id: 'c', label: 'C', zone: 'full-width' });
    expect(window.WidgetRegistry).toHaveLength(3);
  });
});

describe('getWidgetDefs()', () => {
  beforeEach(() => {
    window.WidgetRegistry = [];
    registerWidget({ id: 'quote', label: 'Цитата', zone: 'top' });
    registerWidget({ id: 'todo', label: 'TODO', zone: 'grid' });
  });

  test('returns array of {id, label}', () => {
    const defs = getWidgetDefs();
    expect(defs).toEqual([
      { id: 'quote', label: 'Цитата' },
      { id: 'todo', label: 'TODO' },
    ]);
  });
});

describe('getDefaultWidgetOrder()', () => {
  beforeEach(() => {
    window.WidgetRegistry = [];
    registerWidget({ id: 'a', label: 'A', zone: 'top' });
    registerWidget({ id: 'b', label: 'B', zone: 'grid' });
  });

  test('returns IDs in registration order', () => {
    expect(getDefaultWidgetOrder()).toEqual(['a', 'b']);
  });
});

describe('widgetSettingsKey()', () => {
  test('returns key with username', () => {
    expect(widgetSettingsKey()).toBe('prod_widgets_testuser');
  });

  test('returns default when no user', () => {
    global.getCurrentUser = jest.fn(() => null);
    expect(widgetSettingsKey()).toBe('prod_widgets_default');
    global.getCurrentUser = jest.fn(() => ({ username: 'testuser', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  });
});

describe('loadWidgetSettings() / saveWidgetSettings()', () => {
  test('returns null when no settings saved', () => {
    expect(loadWidgetSettings()).toBeNull();
  });

  test('saves and loads settings', () => {
    const cfg = { order: ['a', 'b'], visible: { a: true, b: false } };
    saveWidgetSettings(cfg);
    expect(loadWidgetSettings()).toEqual(cfg);
  });
});

describe('getWidgetConfig()', () => {
  beforeEach(() => {
    window.WidgetRegistry = [];
    registerWidget({ id: 'a', label: 'A', zone: 'top' });
    registerWidget({ id: 'b', label: 'B', zone: 'grid' });
    registerWidget({ id: 'c', label: 'C', zone: 'full-width' });
  });

  test('returns null when no settings exist', () => {
    expect(getWidgetConfig()).toBeNull();
  });

  test('merges new widgets into saved config', () => {
    saveWidgetSettings({ order: ['a'], visible: { a: true } });
    const cfg = getWidgetConfig();
    expect(cfg.order).toEqual(['a', 'b', 'c']);
    expect(cfg.visible.a).toBe(true);
    expect(cfg.visible.b).toBe(false);
    expect(cfg.visible.c).toBe(false);
  });
});

describe('rerenderAllWidgets()', () => {
  test('calls render on all registered widgets', () => {
    window.WidgetRegistry = [];
    const render1 = jest.fn();
    const render2 = jest.fn();
    registerWidget({ id: 'a', label: 'A', zone: 'top', render: render1 });
    registerWidget({ id: 'b', label: 'B', zone: 'grid', render: render2 });

    rerenderAllWidgets();

    expect(render1).toHaveBeenCalledTimes(1);
    expect(render2).toHaveBeenCalledTimes(1);
  });

  test('skips widgets without render function', () => {
    window.WidgetRegistry = [];
    registerWidget({ id: 'a', label: 'A', zone: 'top' });
    expect(() => rerenderAllWidgets()).not.toThrow();
  });
});

describe('initAllWidgets()', () => {
  test('calls init on widgets that have it', () => {
    window.WidgetRegistry = [];
    const init1 = jest.fn();
    registerWidget({ id: 'a', label: 'A', zone: 'top', init: init1 });
    registerWidget({ id: 'b', label: 'B', zone: 'grid' }); // no init

    initAllWidgets();

    expect(init1).toHaveBeenCalledTimes(1);
  });
});

describe('isNewUser()', () => {
  test('returns true when no widget settings in localStorage', () => {
    expect(isNewUser()).toBe(true);
  });

  test('returns false when settings exist', () => {
    saveWidgetSettings({ order: [], visible: {} });
    expect(isNewUser()).toBe(false);
  });
});

describe('importDefaults()', () => {
  test('imports data into localStorage for new keys', () => {
    importDefaults({ prod_tasks_v1: [{ id: '1', text: 'test' }] });
    expect(JSON.parse(localStorage.getItem('prod_tasks_v1'))).toEqual([{ id: '1', text: 'test' }]);
  });

  test('does not overwrite existing keys', () => {
    localStorage.setItem('prod_tasks_v1', '[]');
    importDefaults({ prod_tasks_v1: [{ id: '1', text: 'test' }] });
    expect(JSON.parse(localStorage.getItem('prod_tasks_v1'))).toEqual([]);
  });

  test('handles null/undefined input', () => {
    expect(() => importDefaults(null)).not.toThrow();
    expect(() => importDefaults(undefined)).not.toThrow();
  });
});

describe('hasPermission() / isAdmin()', () => {
  test('hasPermission returns true for existing permission', () => {
    expect(hasPermission('dashboard')).toBe(true);
    expect(hasPermission('widget_settings')).toBe(true);
  });

  test('hasPermission returns false for missing permission', () => {
    expect(hasPermission('nonexistent')).toBe(false);
  });

  test('isAdmin returns true for admin user', () => {
    expect(isAdmin()).toBe(true);
  });

  test('isAdmin returns false for regular user', () => {
    global.getCurrentUser = jest.fn(() => ({ role: 'user', permissions: [] }));
    expect(isAdmin()).toBe(false);
    global.getCurrentUser = jest.fn(() => ({ username: 'testuser', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  });
});

describe('Admin-only widgets', () => {
  test('loadAdminOnlyWidgets returns empty array by default', () => {
    expect(loadAdminOnlyWidgets()).toEqual([]);
  });

  test('saveAdminOnlyWidgets persists list', () => {
    saveAdminOnlyWidgets(['secret-widget']);
    expect(loadAdminOnlyWidgets()).toEqual(['secret-widget']);
  });

  test('isWidgetAvailable returns true for admin', () => {
    saveAdminOnlyWidgets(['restricted']);
    expect(isWidgetAvailable('restricted')).toBe(true);
  });

  test('isWidgetAvailable returns false for non-admin on restricted widget', () => {
    global.getCurrentUser = jest.fn(() => ({ role: 'user', permissions: [] }));
    saveAdminOnlyWidgets(['restricted']);
    expect(isWidgetAvailable('restricted')).toBe(false);
    global.getCurrentUser = jest.fn(() => ({ username: 'testuser', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  });
});

describe('applyWidgetConfig()', () => {
  beforeEach(() => {
    window.WidgetRegistry = [];
    _defaultsCache = null;
    _widgetConfigCache = null;
  });

  test('merges label, zone, storageKeys from config into registered widgets', () => {
    registerWidget({ id: 'my-test', render: jest.fn() });
    _widgetConfigCache = [
      { id: 'my-test', label: 'Мой виджет', zone: 'grid', storageKeys: ['prod_test_v1'], defaults: {} },
    ];
    applyWidgetConfig();

    const w = window.WidgetRegistry.find(w => w.id === 'my-test');
    expect(w.label).toBe('Мой виджет');
    expect(w.zone).toBe('grid');
    expect(w.storageKeys).toEqual(['prod_test_v1']);
  });

  test('merges widget defaults into global defaults cache', () => {
    _widgetConfigCache = [
      { id: 'x', label: 'X', zone: 'top', storageKeys: [], defaults: { prod_x_v1: { foo: 'bar' } } },
    ];
    applyWidgetConfig();

    expect(getDefault('prod_x_v1')).toEqual({ foo: 'bar' });
  });

  test('does not overwrite existing defaults', () => {
    _defaultsCache = { prod_x_v1: 'existing' };
    _widgetConfigCache = [
      { id: 'x', label: 'X', zone: 'top', storageKeys: [], defaults: { prod_x_v1: 'new' } },
    ];
    applyWidgetConfig();

    expect(getDefault('prod_x_v1')).toBe('existing');
  });

  test('does nothing when config not loaded', () => {
    registerWidget({ id: 'w', render: jest.fn() });
    _widgetConfigCache = null;
    applyWidgetConfig();

    expect(window.WidgetRegistry[0].label).toBeUndefined();
  });
});

describe('applyWidgetConfigSync() — integration', () => {
  beforeEach(() => {
    window.WidgetRegistry = [];
    _defaultsCache = null;
    _widgetConfigCache = null;
  });

  test('loads real widgets-config.json and merges into registry', () => {
    registerWidget({ id: 'quote', render: jest.fn() });
    registerWidget({ id: 'todo', render: jest.fn() });
    applyWidgetConfigSync();

    const quote = window.WidgetRegistry.find(w => w.id === 'quote');
    expect(quote.label).toBe('Цитата из бесед Аристотеля');
    expect(quote.zone).toBe('top');

    const todo = window.WidgetRegistry.find(w => w.id === 'todo');
    expect(todo.label).toBe('TODO список');
    expect(todo.zone).toBe('grid');
    expect(todo.storageKeys).toEqual(['prod_tasks_v1', 'prod_history_v1']);
  });

  test('makes widget defaults available via getDefault()', () => {
    registerWidget({ id: 'principles', render: jest.fn() });
    applyWidgetConfigSync();

    const defaults = getDefault('prod_principles_v1');
    expect(Array.isArray(defaults)).toBe(true);
    expect(defaults.length).toBe(5);
    expect(defaults[0].id).toBe('p1');
  });
});

describe('importWidgetDefaults()', () => {
  beforeEach(() => {
    localStorage.clear();
    _widgetConfigCache = null;
  });

  test('imports widget defaults into localStorage', () => {
    _widgetConfigCache = [
      { id: 'w', label: 'W', zone: 'grid', storageKeys: ['prod_w_v1'], defaults: { prod_w_v1: [1, 2, 3] } },
    ];
    importWidgetDefaults();

    expect(JSON.parse(localStorage.getItem('prod_w_v1'))).toEqual([1, 2, 3]);
  });

  test('does not overwrite existing localStorage keys', () => {
    localStorage.setItem('prod_w_v1', '"existing"');
    _widgetConfigCache = [
      { id: 'w', label: 'W', zone: 'grid', storageKeys: ['prod_w_v1'], defaults: { prod_w_v1: 'new' } },
    ];
    importWidgetDefaults();

    expect(JSON.parse(localStorage.getItem('prod_w_v1'))).toBe('existing');
  });

  test('does nothing when config not loaded', () => {
    _widgetConfigCache = null;
    expect(() => importWidgetDefaults()).not.toThrow();
  });
});
