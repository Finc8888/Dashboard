const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('target.js');
  applyWidgetConfigSync();
});

describe('Target — load / save targets', () => {
  beforeEach(() => { localStorage.clear(); });

  test('loadTargets returns empty array when no data', () => {
    expect(loadTargets()).toEqual([]);
  });

  test('saveTargets / loadTargets roundtrip', () => {
    const targets = [{ id: 't1', title: 'Выучить Go', createdAt: '2025-04-01' }];
    saveTargets(targets);
    expect(loadTargets()).toEqual(targets);
  });
});

describe('Target — load / save steps', () => {
  beforeEach(() => { localStorage.clear(); });

  test('loadTargetSteps returns empty object when no data', () => {
    expect(loadTargetSteps()).toEqual({});
  });

  test('saveTargetSteps / loadTargetSteps roundtrip', () => {
    const steps = { t1: [{ id: 's1', title: 'Шаг 1', done: false, createdAt: '2025-04-01' }] };
    saveTargetSteps(steps);
    expect(loadTargetSteps()).toEqual(steps);
  });
});

const targetDom = `
  <span id="target-done-count">0</span>
  <span id="target-total-count">0</span>
  <div id="target-progress-fill"></div>
  <div id="target-list-container"></div>
  <input id="target-add-title" value="Новая цель" />
`;

describe('Target — targetAdd()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
  });

  test('adds target with correct structure', () => {
    targetAdd();
    const targets = loadTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].title).toBe('Новая цель');
    expect(targets[0].id).toMatch(/^target-/);
    expect(targets[0].createdAt).toBeDefined();
  });

  test('initializes empty steps for new target', () => {
    targetAdd();
    const steps = loadTargetSteps();
    const targetId = loadTargets()[0].id;
    expect(steps[targetId]).toEqual([]);
  });

  test('clears input field after adding', () => {
    targetAdd();
    expect(document.getElementById('target-add-title').value).toBe('');
  });

  test('does nothing with empty title', () => {
    document.getElementById('target-add-title').value = '   ';
    targetAdd();
    expect(loadTargets()).toHaveLength(0);
  });
});

describe('Target — targetRemove()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    global.confirm = jest.fn(() => true);
    saveTargets([
      { id: 't1', title: 'Keep', createdAt: '2025-04-01' },
      { id: 't2', title: 'Remove', createdAt: '2025-04-01' },
    ]);
    saveTargetSteps({
      t1: [{ id: 's1', title: 'Step', done: false, createdAt: '2025-04-01' }],
      t2: [{ id: 's2', title: 'Step', done: false, createdAt: '2025-04-01' }],
    });
  });

  test('removes target and its steps', () => {
    targetRemove('t2');
    expect(loadTargets()).toHaveLength(1);
    expect(loadTargets()[0].id).toBe('t1');
    expect(loadTargetSteps().t2).toBeUndefined();
  });

  test('does nothing if user cancels', () => {
    global.confirm = jest.fn(() => false);
    targetRemove('t1');
    expect(loadTargets()).toHaveLength(2);
  });
});

describe('Target — targetMove()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    saveTargets([
      { id: 't1', title: 'First', createdAt: '2025-04-01' },
      { id: 't2', title: 'Second', createdAt: '2025-04-01' },
      { id: 't3', title: 'Third', createdAt: '2025-04-01' },
    ]);
    saveTargetSteps({ t1: [], t2: [], t3: [] });
  });

  test('moves target up', () => {
    targetMove('t2', -1);
    const targets = loadTargets();
    expect(targets[0].id).toBe('t2');
    expect(targets[1].id).toBe('t1');
  });

  test('moves target down', () => {
    targetMove('t2', 1);
    const targets = loadTargets();
    expect(targets[1].id).toBe('t3');
    expect(targets[2].id).toBe('t2');
  });

  test('does nothing if moving beyond bounds', () => {
    targetMove('t1', -1);
    expect(loadTargets()[0].id).toBe('t1');
  });
});

describe('Target — targetStartEdit() / targetSaveEdit()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    saveTargets([{ id: 't1', title: 'Old Title', createdAt: '2025-04-01' }]);
    saveTargetSteps({ t1: [] });
    renderTargets();
  });

  test('renders edit form', () => {
    targetStartEdit('t1');
    const el = document.getElementById('target-row-t1');
    expect(el.querySelector('.target-edit-input')).toBeTruthy();
  });

  test('saves edited title', () => {
    targetStartEdit('t1');
    document.getElementById('edit-target-title-t1').value = 'New Title';
    targetSaveEdit('t1');
    expect(loadTargets()[0].title).toBe('New Title');
  });

  test('does nothing with empty title', () => {
    targetStartEdit('t1');
    document.getElementById('edit-target-title-t1').value = '   ';
    targetSaveEdit('t1');
    expect(loadTargets()[0].title).toBe('Old Title');
  });
});

describe('Target — toggleTargetExpand()', () => {
  beforeEach(() => {
    document.body.innerHTML = targetDom;
  });

  test('toggles expand state', () => {
    toggleTargetExpand('t1');
    expect(expandedTargets.t1).toBe(true);

    toggleTargetExpand('t1');
    expect(expandedTargets.t1).toBe(false);
  });
});

describe('Target — targetAddStep()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom + `<input id="step-add-input-t1" value="Новый шаг" />`;
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({ t1: [] });
  });

  test('adds step to target', () => {
    targetAddStep('t1');
    const steps = loadTargetSteps();
    expect(steps.t1).toHaveLength(1);
    expect(steps.t1[0].title).toBe('Новый шаг');
    expect(steps.t1[0].done).toBe(false);
    expect(steps.t1[0].id).toMatch(/^step-/);
  });

  test('does nothing with empty title', () => {
    document.getElementById('step-add-input-t1').value = '   ';
    targetAddStep('t1');
    expect(loadTargetSteps().t1).toHaveLength(0);
  });

  test('appends to existing steps', () => {
    targetAddStep('t1');
    document.getElementById('step-add-input-t1').value = 'Второй шаг';
    targetAddStep('t1');
    expect(loadTargetSteps().t1).toHaveLength(2);
  });
});

describe('Target — targetRemoveStep()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({
      t1: [
        { id: 's1', title: 'Keep', done: false, createdAt: '2025-04-01' },
        { id: 's2', title: 'Remove', done: false, createdAt: '2025-04-01' },
      ],
    });
  });

  test('removes step from target', () => {
    targetRemoveStep('t1', 's2');
    const steps = loadTargetSteps();
    expect(steps.t1).toHaveLength(1);
    expect(steps.t1[0].id).toBe('s1');
  });
});

describe('Target — targetMoveStep()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({
      t1: [
        { id: 's1', title: 'First', done: false, createdAt: '2025-04-01' },
        { id: 's2', title: 'Second', done: false, createdAt: '2025-04-01' },
        { id: 's3', title: 'Third', done: false, createdAt: '2025-04-01' },
      ],
    });
  });

  test('moves step up', () => {
    targetMoveStep('t1', 's2', -1);
    const steps = loadTargetSteps();
    expect(steps.t1[0].id).toBe('s2');
    expect(steps.t1[1].id).toBe('s1');
  });

  test('moves step down', () => {
    targetMoveStep('t1', 's2', 1);
    const steps = loadTargetSteps();
    expect(steps.t1[1].id).toBe('s3');
    expect(steps.t1[2].id).toBe('s2');
  });
});

describe('Target — targetStartEditStep() / targetSaveEditStep()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({
      t1: [{ id: 's1', title: 'Old Step', done: false, createdAt: '2025-04-01' }],
    });
    renderTargets();
  });

  test('renders edit form for step', () => {
    toggleTargetExpand('t1');
    renderTargets();
    targetStartEditStep('t1', 's1');
    const el = document.getElementById('step-row-s1');
    expect(el).toBeTruthy();
    expect(el.querySelector('.step-edit-input')).toBeTruthy();
  });

  test('saves edited step title', () => {
    toggleTargetExpand('t1');
    renderTargets();
    targetStartEditStep('t1', 's1');
    const input = document.getElementById('edit-step-title-s1');
    if (input) {
      input.value = 'New Step Title';
      targetSaveEditStep('t1', 's1');
      expect(loadTargetSteps().t1[0].title).toBe('New Step Title');
    }
  });
});

describe('Target — targetToggleStep()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({
      t1: [{ id: 's1', title: 'Step', done: false, createdAt: '2025-04-01' }],
    });
  });

  test('toggles step done status', () => {
    targetToggleStep('t1', 's1');
    const steps = loadTargetSteps();
    expect(steps.t1[0].done).toBe(true);

    targetToggleStep('t1', 's1');
    expect(loadTargetSteps().t1[0].done).toBe(false);
  });
});

describe('Target — targetCheckCompletion()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    global.document.body.appendChild = jest.fn();
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({
      t1: [
        { id: 's1', title: 'Step 1', done: false, createdAt: '2025-04-01' },
        { id: 's2', title: 'Step 2', done: false, createdAt: '2025-04-01' },
      ],
    });
  });

  test('triggers celebration when all steps are done', () => {
    targetToggleStep('t1', 's1');
    targetToggleStep('t1', 's2');
    expect(document.body.appendChild).toHaveBeenCalled();
  });

  test('does not trigger celebration with incomplete steps', () => {
    const spy = jest.spyOn(window, 'targetTriggerCelebration');
    targetToggleStep('t1', 's1');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Target — toggleTargetEditMode()', () => {
  beforeEach(() => {
    document.body.innerHTML = targetDom;
  });

  test('toggles edit mode', () => {
    expect(_targetEditMode).toBe(false);
    toggleTargetEditMode();
    expect(_targetEditMode).toBe(true);
    toggleTargetEditMode();
    expect(_targetEditMode).toBe(false);
  });
});

describe('Target — targetClearAll()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = targetDom;
    global.confirm = jest.fn(() => true);
    saveTargets([{ id: 't1', title: 'Target', createdAt: '2025-04-01' }]);
    saveTargetSteps({ t1: [{ id: 's1', title: 'Step', done: false, createdAt: '2025-04-01' }] });
  });

  test('clears all targets and steps', () => {
    targetClearAll();
    expect(loadTargets()).toEqual([]);
    expect(loadTargetSteps()).toEqual({});
  });

  test('does nothing if user cancels', () => {
    global.confirm = jest.fn(() => false);
    targetClearAll();
    expect(loadTargets()).toHaveLength(1);
  });
});

describe('Target — renderTargets()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <span id="target-done-count">0</span>
      <span id="target-total-count">0</span>
      <div id="target-progress-fill"></div>
      <div id="target-list-container"></div>
      <input id="target-add-title" value="" />
    `;
  });

  test('renders empty state', () => {
    renderTargets();
    const container = document.getElementById('target-list-container');
    expect(container.querySelector('.target-empty')).toBeTruthy();
  });

  test('renders targets with correct counts', () => {
    saveTargets([
      { id: 't1', title: 'Target 1', createdAt: '2025-04-01' },
      { id: 't2', title: 'Target 2', createdAt: '2025-04-01' },
    ]);
    saveTargetSteps({
      t1: [{ id: 's1', title: 'Step', done: true, createdAt: '2025-04-01' }],
      t2: [{ id: 's2', title: 'Step', done: false, createdAt: '2025-04-01' }],
    });
    renderTargets();

    expect(document.getElementById('target-done-count').textContent).toBe('1');
    expect(document.getElementById('target-total-count').textContent).toBe('2');
  });

  test('renders add form at the bottom', () => {
    renderTargets();
    const container = document.getElementById('target-list-container');
    expect(container.querySelector('.target-add-form')).toBeTruthy();
    expect(container.querySelector('#target-add-title')).toBeTruthy();
  });
});

describe('Target — registration', () => {
  test('registers with correct metadata', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'target');
    expect(widget).toBeTruthy();
    expect(widget.zone).toBe('full-width');
  });
});
