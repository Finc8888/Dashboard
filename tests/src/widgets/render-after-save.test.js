/**
 * CRUD + render-after-save tests for ALL widgets.
 *
 * Every function that mutates state (localStorage / UI state) MUST call its
 * widget's render function so the DOM stays in sync without a page reload.
 *
 * Pattern: spy on the render function, call the mutation, assert the spy fired.
 */
const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

// ── Bootstrap ────────────────────────────────────────────────────────────
beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({
    username: 'test', role: 'admin',
    permissions: ['dashboard', 'widget_settings'],
  }));
  global.dayOff = false;
  global.sendNotification = jest.fn();
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  global.prompt = jest.fn(() => '2026-01-15');
  global.confirm = jest.fn(() => true);
  global.alert = jest.fn();
  global.navigator = { clipboard: { writeText: jest.fn(() => Promise.resolve()) } };

  loadCore();
  loadWidget('goals.js');
  loadWidget('personal-bar.js');
  loadWidget('schedule.js');
  loadWidget('todo.js');
  loadWidget('stickers.js');
  loadWidget('weekend-plan.js');
  loadWidget('running.js');
  loadWidget('reading.js');
  loadWidget('principles.js');
  loadWidget('key-skills.js');
  loadWidget('stats.js');
  loadWidget('server-build.js');
  loadWidget('scratchpad.js');
  applyWidgetConfigSync();
});


// ═══════════════════════════════════════════════════════════════════════════
//  TODO
// ═══════════════════════════════════════════════════════════════════════════
const todoDom = `
  <span id="todo-done-count">0</span>
  <span id="todo-total-count">0</span>
  <div id="todo-list"></div>
  <div id="history-panel"><div id="history-list"></div></div>
`;

describe('TODO — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = todoDom;
    global.renderProdStats = jest.fn();
    spy = jest.spyOn(window, 'renderTodo');
  });
  afterEach(() => spy.mockRestore());

  // ── Create ──
  test('addTask persists task and renders', () => {
    addTask('Buy milk');
    expect(loadTasks()).toHaveLength(1);
    expect(loadTasks()[0].text).toBe('Buy milk');
    expect(spy).toHaveBeenCalled();
  });

  test('addTask trims whitespace', () => {
    addTask('  padded  ');
    expect(loadTasks()[0].text).toBe('padded');
  });

  // ── Read ──
  test('renderTodo shows empty state', () => {
    renderTodo();
    expect(document.getElementById('todo-list').textContent).toContain('Все задачи выполнены');
  });

  test('renderTodo shows task items', () => {
    addTask('Item 1');
    spy.mockClear();
    renderTodo();
    expect(document.querySelectorAll('.todo-item').length).toBe(1);
    expect(document.getElementById('todo-list').textContent).toContain('Item 1');
  });

  // ── Update ──
  test('setCurrentTask marks task and renders', () => {
    addTask('A');
    addTask('B');
    spy.mockClear();
    const id = loadTasks()[1].id;
    setCurrentTask(id);
    expect(spy).toHaveBeenCalled();
    expect(loadTasks()[0].current).toBe(true);
    expect(loadTasks()[0].id).toBe(id); // moved to top
  });

  test('setCurrentTask toggles off', () => {
    addTask('A');
    const id = loadTasks()[0].id;
    setCurrentTask(id);
    spy.mockClear();
    setCurrentTask(id);
    expect(spy).toHaveBeenCalled();
    expect(loadTasks()[0].current).toBe(false);
  });

  test('toggleTask completes task, moves to history, and renders', () => {
    addTask('Done');
    const id = loadTasks()[0].id;
    spy.mockClear();
    toggleTask(id);
    expect(spy).toHaveBeenCalled();
    expect(loadTasks()).toHaveLength(0);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].text).toBe('Done');
  });

  // ── Delete ──
  test('deleteTask removes task and renders', () => {
    addTask('Remove me');
    const id = loadTasks()[0].id;
    spy.mockClear();
    deleteTask(id);
    expect(spy).toHaveBeenCalled();
    expect(loadTasks()).toHaveLength(0);
  });

  // ── Rename ──
  test('startRenameTask save calls renderTodo', () => {
    addTask('Original');
    renderTodo(); // need DOM items
    spy.mockClear();
    const id = loadTasks()[0].id;
    startRenameTask(id);
    // Simulate rename: find input, change value, blur
    const input = document.querySelector('.todo-rename-input');
    expect(input).toBeTruthy();
    input.value = 'Renamed';
    input.dispatchEvent(new Event('blur'));
    expect(spy).toHaveBeenCalled();
    expect(loadTasks()[0].text).toBe('Renamed');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Stickers
// ═══════════════════════════════════════════════════════════════════════════
describe('Stickers — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="sticker-board"></div><input id="sticker-input" value="Note" />';
    spy = jest.spyOn(window, 'renderStickers');
  });
  afterEach(() => spy.mockRestore());

  test('addSticker creates sticker and renders', () => {
    addSticker();
    expect(loadStickers()).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });

  test('toggleSticker toggles done and renders', () => {
    addSticker();
    spy.mockClear();
    const id = loadStickers()[0].id;
    toggleSticker(id);
    expect(loadStickers()[0].done).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  test('changeStickerColor changes color and renders', () => {
    addSticker();
    const orig = loadStickers()[0].color;
    spy.mockClear();
    changeStickerColor(loadStickers()[0].id);
    expect(loadStickers()[0].color).not.toBe(orig);
    expect(spy).toHaveBeenCalled();
  });

  test('deleteSticker removes and renders', () => {
    addSticker();
    spy.mockClear();
    deleteSticker(loadStickers()[0].id);
    expect(loadStickers()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  test('renderStickers shows empty state', () => {
    renderStickers();
    expect(document.getElementById('sticker-board').textContent).toContain('Доска пуста');
  });

  test('renderStickers renders notes', () => {
    addSticker();
    spy.mockClear();
    renderStickers();
    expect(document.querySelectorAll('.sticker-note').length).toBe(1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Weekend Plan
// ═══════════════════════════════════════════════════════════════════════════
const wpDom = `
  <div id="wp-list"></div>
  <span id="wp-done-count">0</span>
  <span id="wp-total-count">0</span>
`;

describe('Weekend Plan — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = wpDom;
    spy = jest.spyOn(window, 'renderWeekendPlan');
  });
  afterEach(() => spy.mockRestore());

  test('addWpTask creates task and renders', () => {
    addWpTask('Relax');
    expect(loadWpTasks()).toHaveLength(1);
    expect(loadWpTasks()[0].text).toBe('Relax');
    expect(spy).toHaveBeenCalled();
  });

  test('toggleWpTask toggles done and renders', () => {
    addWpTask('Do');
    spy.mockClear();
    toggleWpTask(loadWpTasks()[0].id);
    expect(loadWpTasks()[0].done).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  test('deleteWpTask removes and renders', () => {
    addWpTask('Gone');
    spy.mockClear();
    deleteWpTask(loadWpTasks()[0].id);
    expect(loadWpTasks()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  test('startRenameWpTask save calls renderWeekendPlan', () => {
    addWpTask('Old name');
    renderWeekendPlan();
    spy.mockClear();
    startRenameWpTask(loadWpTasks()[0].id);
    const input = document.querySelector('.todo-rename-input');
    expect(input).toBeTruthy();
    input.value = 'New name';
    input.dispatchEvent(new Event('blur'));
    expect(spy).toHaveBeenCalled();
    expect(loadWpTasks()[0].text).toBe('New name');
  });

  test('renderWeekendPlan shows empty state', () => {
    renderWeekendPlan();
    expect(document.getElementById('wp-list').textContent).toContain('Планов пока нет');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Personal Bar
// ═══════════════════════════════════════════════════════════════════════════
const personalBarDom = `
  <div id="days-counter">0</div>
  <div id="days-since-label"></div>
  <div id="days-fail-badges"></div>
  <div id="cushion-count">0</div>
  <div id="mort-payment">0</div><div id="mort-debt">0</div>
  <div id="mort-rate">0</div><div id="mort-dates">—</div><div id="mort-payday">—</div>
  <div id="mortgage-display"></div>
  <div id="mortgage-edit-panel" style="display:none"></div>
  <div id="mortgage-edit-btn"></div>
  <input id="mort-input-payment" value="50000" />
  <input id="mort-input-debt" value="3000000" />
  <input id="mort-input-rate" value="12" />
  <input id="mort-input-start" value="2025-01-01" />
  <input id="mort-input-end" value="2045-01-01" />
  <input id="mort-input-payday" value="15" />
`;

describe('Personal Bar — CRUD + render', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = personalBarDom;
  });

  test('resetDaysCounter increments failCount and renders', () => {
    saveDaysData({ startDate: '2026-01-01', failCount: 0 });
    const spy = jest.spyOn(window, 'renderDaysCounter');
    resetDaysCounter();
    expect(loadDaysData().failCount).toBe(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('editDaysDate updates date and renders', () => {
    saveDaysData({ startDate: '2026-01-01', failCount: 0 });
    const spy = jest.spyOn(window, 'renderDaysCounter');
    editDaysDate();
    expect(loadDaysData().startDate).toBe('2026-01-15');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('changeCushions updates count and renders', () => {
    const spy = jest.spyOn(window, 'renderCushions');
    changeCushions(1);
    expect(getCushions()).toBe(1);
    changeCushions(1);
    expect(getCushions()).toBe(2);
    changeCushions(-1);
    expect(getCushions()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  test('changeCushions does not go below 0', () => {
    changeCushions(-1);
    expect(getCushions()).toBe(0);
  });

  test('saveMortgage persists data and renders', () => {
    const spy = jest.spyOn(window, 'renderMortgage');
    saveMortgage();
    const d = loadMortgage();
    expect(d.payment).toBe(50000);
    expect(d.debt).toBe(3000000);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renderPersonalBar renders all sub-widgets', () => {
    saveDaysData({ startDate: '2026-01-01', failCount: 2 });
    localStorage.setItem('prod_cushions', '5');
    saveMortgageData({ payment: 40000, debt: 2000000, rate: 12, startDate: '2025-01-01', endDate: '2045-01-01', payDay: 15 });
    renderPersonalBar();
    expect(document.getElementById('cushion-count').textContent).toBe('5');
    expect(document.getElementById('days-fail-badges').innerHTML).toContain('💔');
    expect(document.getElementById('mort-payday').textContent).toContain('15');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Schedule
// ═══════════════════════════════════════════════════════════════════════════
describe('Schedule — CRUD + render', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="timeline"></div>
      <input id="slot-edit-label-0" value="Custom Label" />
      <input id="slot-edit-sub-0" value="Custom Sub" />
    `;
  });

  test('saveSlotLabel persists and renders', () => {
    const spy = jest.spyOn(window, 'renderTimeline');
    saveSlotLabel(0);
    expect(loadScheduleLabels()[0]).toEqual({ label: 'Custom Label', sub: 'Custom Sub' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('saveSlotLabel does nothing with empty label', () => {
    document.getElementById('slot-edit-label-0').value = '';
    const spy = jest.spyOn(window, 'renderTimeline');
    saveSlotLabel(0);
    expect(loadScheduleLabels()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renderTimeline renders all slots', () => {
    renderTimeline();
    expect(document.querySelectorAll('.slot').length).toBe(16);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Running
// ═══════════════════════════════════════════════════════════════════════════
describe('Running — CRUD + render', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="running-grid"></div>
      <input id="run-input-5km" value="25:00" />
      <input id="run-date-5km" value="2026-04-01" />
      <input id="run-edit-time" value="24:00" />
      <input id="run-edit-date" value="2026-04-02" />
    `;
  });

  test('submitRunResult persists and renders', () => {
    const spy = jest.spyOn(window, 'renderRunning');
    submitRunResult('5km');
    const data = loadRunning();
    expect(data['5km']).toHaveLength(1);
    expect(data['5km'][0].secs).toBe(1500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('submitRunResult rejects invalid time', () => {
    document.getElementById('run-input-5km').value = 'invalid';
    const spy = jest.spyOn(window, 'renderRunning');
    submitRunResult('5km');
    expect(loadRunning()['5km']).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('deleteRunResult removes entry and renders', () => {
    saveRunning({ '5km': [{ secs: 1500, date: '2026-04-01' }, { secs: 1600, date: '2026-04-02' }] });
    const spy = jest.spyOn(window, 'renderRunning');
    deleteRunResult('5km', 1);
    expect(loadRunning()['5km']).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('saveEditRun updates entry and renders', () => {
    saveRunning({ '5km': [{ secs: 1500, date: '2026-04-01' }] });
    runEditState = { distId: '5km', idx: 0 };
    const spy = jest.spyOn(window, 'renderRunning');
    saveEditRun('5km', 0);
    expect(loadRunning()['5km'][0].secs).toBe(1440); // 24:00
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('startEditRun and cancelEditRun render', () => {
    const spy = jest.spyOn(window, 'renderRunning');
    startEditRun('5km', 0);
    expect(runEditState).toEqual({ distId: '5km', idx: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
    cancelEditRun();
    expect(runEditState).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Reading
// ═══════════════════════════════════════════════════════════════════════════
const readingDom = `
  <span id="reading-done-count">0</span>
  <span id="reading-total-count">0</span>
  <div id="reading-progress-fill"></div>
  <div id="reading-books"></div>
  <input id="reading-add-title" value="Книга" />
  <input id="reading-add-author" value="Автор" />
  <input id="reading-add-type" value="роман" />
`;

describe('Reading — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = readingDom;
    spy = jest.spyOn(window, 'renderReadingList');
  });
  afterEach(() => spy.mockRestore());

  test('addBook creates book and renders', () => {
    addBook();
    expect(loadReadingBooks()).toHaveLength(1);
    expect(loadReadingBooks()[0].title).toBe('Книга');
    expect(spy).toHaveBeenCalled();
  });

  test('removeBook deletes and renders', () => {
    saveReadingBooks([{ id: 'b1', title: 'T', author: 'A', type: 'роман' }]);
    spy.mockClear();
    removeBook('b1');
    expect(loadReadingBooks()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  test('moveBook reorders and renders', () => {
    saveReadingBooks([
      { id: 'b1', title: 'First', author: 'A', type: 'роман' },
      { id: 'b2', title: 'Second', author: 'B', type: 'роман' },
    ]);
    spy.mockClear();
    moveBook('b1', 1);
    expect(loadReadingBooks()[0].id).toBe('b2');
    expect(spy).toHaveBeenCalled();
  });

  test('cycleBookStatus cycles waiting → reading → done and renders', () => {
    saveReadingBooks([{ id: 'b1', title: 'T', author: 'A', type: 'роман' }]);
    spy.mockClear();
    cycleBookStatus('b1');
    expect(loadReading()['b1'].status).toBe('reading');
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    cycleBookStatus('b1');
    expect(loadReading()['b1'].status).toBe('done');
    expect(spy).toHaveBeenCalled();
  });

  test('toggleSubItemStatus marks sub-item and updates parent', () => {
    saveReadingBooks([{
      id: 'b1', title: 'T', author: 'A', type: 'сборник',
      subItems: [{ id: 's1', title: 'Sub1' }],
    }]);
    spy.mockClear();
    toggleSubItemStatus('b1', 's1');
    expect(loadReading()['s1'].status).toBe('done');
    expect(loadReading()['b1'].status).toBe('done');
    expect(spy).toHaveBeenCalled();
  });

  test('clearReadingList empties everything and renders', () => {
    saveReadingBooks([{ id: 'b1', title: 'T', author: 'A', type: 'роман' }]);
    spy.mockClear();
    clearReadingList();
    expect(loadReadingBooks()).toHaveLength(0);
    expect(loadReading()).toEqual({});
    expect(spy).toHaveBeenCalled();
  });

  test('toggleBookExpand toggles state and renders', () => {
    spy.mockClear();
    toggleBookExpand('b1');
    expect(expandedBooks.b1).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  test('toggleReadingEditMode toggles and renders', () => {
    spy.mockClear();
    toggleReadingEditMode();
    expect(spy).toHaveBeenCalled();
  });

  test('renderReadingList shows progress bar', () => {
    saveReadingBooks([
      { id: 'b1', title: 'Done', author: 'A', type: 'роман' },
      { id: 'b2', title: 'Not', author: 'B', type: 'роман' },
    ]);
    saveReading({ b1: { status: 'done', page: 0, startedAt: null } });
    spy.mockClear();
    renderReadingList();
    expect(document.getElementById('reading-done-count').textContent).toBe('1');
    expect(document.getElementById('reading-total-count').textContent).toBe('2');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Goals
// ═══════════════════════════════════════════════════════════════════════════
const goalsDom = `
  <span id="monthly-goals-title"></span>
  <div id="monthly-goals"></div>
  <div id="monthly-goals-progress"></div>
  <span id="yearly-goals-title"></span>
  <div id="yearly-goals"></div>
  <div id="yearly-goals-progress"></div>
`;

describe('Goals — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = goalsDom;
    spy = jest.spyOn(window, 'renderAllGoals');
  });
  afterEach(() => spy.mockRestore());

  test('addGoal creates goal', () => {
    addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), 'Learn Go');
    const goals = getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey());
    expect(goals).toHaveLength(1);
    expect(goals[0].text).toBe('Learn Go');
    expect(goals[0].done).toBe(false);
  });

  test('toggleGoal toggles done', () => {
    addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), 'Toggle me');
    const id = getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey())[0].id;
    toggleGoal(MONTHLY_GOALS_KEY, currentMonthKey(), id);
    expect(getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey())[0].done).toBe(true);
  });

  test('deleteGoal removes goal', () => {
    addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), 'Delete me');
    const id = getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey())[0].id;
    deleteGoal(MONTHLY_GOALS_KEY, currentMonthKey(), id);
    expect(getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey())).toHaveLength(0);
  });

  test('saveGoalEdit updates text', () => {
    addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), 'Old');
    const id = getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey())[0].id;
    saveGoalEdit(MONTHLY_GOALS_KEY, currentMonthKey(), id, 'New');
    expect(getGoalsForPeriod(MONTHLY_GOALS_KEY, currentMonthKey())[0].text).toBe('New');
  });

  test('startGoalEdit and cancelGoalEdit render', () => {
    startGoalEdit('some-id');
    expect(spy).toHaveBeenCalled();
    spy.mockClear();
    cancelGoalEdit();
    expect(spy).toHaveBeenCalled();
  });

  test('renderAllGoals renders both monthly and yearly', () => {
    addGoal(MONTHLY_GOALS_KEY, currentMonthKey(), 'Monthly goal');
    addGoal(YEARLY_GOALS_KEY, currentYearKey(), 'Yearly goal');
    spy.mockClear();
    renderAllGoals();
    expect(document.getElementById('monthly-goals').textContent).toContain('Monthly goal');
    expect(document.getElementById('yearly-goals').textContent).toContain('Yearly goal');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Principles
// ═══════════════════════════════════════════════════════════════════════════
const principlesDom = `
  <div id="principles-list"></div>
  <div id="principle-add-row"></div>
  <div id="principle-form" style="display:none"></div>
  <input id="principle-icon-input" value="🎯" />
  <input id="principle-title-input" value="Focus" />
  <input id="principle-desc-input" value="Stay focused" />
  <select id="principle-color-input"><option value="red">Red</option></select>
`;

describe('Principles — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    savePrinciples([]);
    document.body.innerHTML = principlesDom;
    _editingPrincipleId = null;
    spy = jest.spyOn(window, 'renderPrinciples');
  });
  afterEach(() => spy.mockRestore());

  test('savePrincipleForm creates principle and renders', () => {
    savePrincipleForm();
    const principles = loadPrinciples();
    expect(principles).toHaveLength(1);
    expect(principles[0].title).toBe('Focus');
    expect(spy).toHaveBeenCalled();
  });

  test('savePrincipleForm edits existing principle', () => {
    savePrinciples([{ id: 'p1', icon: '🎯', title: 'Old', desc: 'Desc', color: 'red' }]);
    _editingPrincipleId = 'p1';
    document.getElementById('principle-title-input').value = 'Updated';
    spy.mockClear();
    savePrincipleForm();
    expect(loadPrinciples()[0].title).toBe('Updated');
    expect(spy).toHaveBeenCalled();
  });

  test('deletePrinciple removes and renders', () => {
    savePrinciples([{ id: 'p1', icon: '🎯', title: 'T', desc: 'D', color: 'red' }]);
    spy.mockClear();
    deletePrinciple('p1');
    expect(loadPrinciples()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  test('renderPrinciples renders items', () => {
    savePrinciples([
      { id: 'p1', icon: '🎯', title: 'Focus', desc: 'Desc', color: 'red' },
    ]);
    spy.mockClear();
    renderPrinciples();
    expect(document.querySelectorAll('.principle').length).toBe(1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Key Skills
// ═══════════════════════════════════════════════════════════════════════════
describe('Key Skills — CRUD + render', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="key-skills-list"></div>';
  });

  test('saveKeySkills / loadKeySkills roundtrip', () => {
    const skills = [{ id: 1, name: 'Go', category: 'Язык программирования' }];
    saveKeySkills(skills);
    expect(loadKeySkills()).toEqual(skills);
  });

  test('removeKeySkill removes skill and renders', () => {
    saveKeySkills([{ id: 1, name: 'Go', category: 'Язык программирования' }]);
    const spy = jest.spyOn(window, 'renderKeySkills');
    removeKeySkill(1);
    expect(loadKeySkills()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renderKeySkills renders items', () => {
    saveKeySkills([{ id: 1, name: 'Go', category: 'Язык программирования' }]);
    renderKeySkills();
    expect(document.querySelectorAll('.principle').length).toBe(1);
    expect(document.getElementById('key-skills-list').textContent).toContain('Go');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Stats
// ═══════════════════════════════════════════════════════════════════════════
const statsDom = `
  <div id="stat-early">0</div>
  <div id="stat-early-label"></div>
  <div id="stat-early-sub"></div>
  <div id="stat-distraction-count">0</div>
  <div id="distraction-panel" style="display:none"></div>
  <div id="distraction-weekly"></div>
`;

describe('Stats — CRUD + render', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = statsDom;
  });

  test('checkEarlyLogin at 7:30 records success and renders', () => {
    const realDate = Date;
    const mockDate = new realDate(2026, 3, 6, 7, 30, 0);
    jest.spyOn(global, 'Date').mockImplementation((...args) => {
      if (args.length) return new realDate(...args);
      return mockDate;
    });
    global.Date.now = () => mockDate.getTime();

    const spy = jest.spyOn(window, 'renderEarlyStat');
    checkEarlyLogin();
    const data = loadEarlyData();
    expect(Object.values(data[getEarlyMonthKey()])[0].success).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    jest.restoreAllMocks();
    global.Date = realDate;
  });

  test('logDistraction logs and renders', () => {
    const spy = jest.spyOn(window, 'renderDistractionWidget');
    logDistraction('youtube');
    const today = localDateStr(new Date());
    expect(loadDistractions()[today]).toHaveLength(1);
    expect(loadDistractions()[today][0].category).toBe('youtube');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renderStats updates DOM', () => {
    const mk = getEarlyMonthKey();
    saveEarlyData({ [mk]: { '2026-04-01': { success: true }, '2026-04-02': { success: true } } });
    const today = localDateStr(new Date());
    saveDistractions({ [today]: [{ category: 'youtube' }] });
    renderStats();
    expect(document.getElementById('stat-early').textContent).toBe('2');
    expect(document.getElementById('stat-distraction-count').textContent).toBe('1');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Server Build
// ═══════════════════════════════════════════════════════════════════════════
const sbDom = `
  <div id="sb-table-wrap"></div>
  <div id="sb-total"></div>
  <div id="sb-models-list"></div>
`;

describe('Server Build — CRUD + render', () => {
  let spy;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = sbDom;
    spy = jest.spyOn(window, 'renderServerBuild');
  });
  afterEach(() => spy.mockRestore());

  test('sbAddRow creates row and renders', () => {
    sbAddRow();
    expect(loadServerBuild()).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });

  test('sbDeleteRow removes and renders', () => {
    sbAddRow();
    spy.mockClear();
    sbDeleteRow(loadServerBuild()[0].id);
    expect(loadServerBuild()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  test('sbUpdateField updates field and renders', () => {
    sbAddRow();
    const id = loadServerBuild()[0].id;
    spy.mockClear();
    sbUpdateField(id, 'component', 'GPU');
    expect(loadServerBuild()[0].component).toBe('GPU');
    expect(spy).toHaveBeenCalled();
  });

  test('sbUpdateField updates price and recalculates total', () => {
    sbAddRow();
    const id = loadServerBuild()[0].id;
    spy.mockClear();
    sbUpdateField(id, 'price', '~89 000 ₽');
    expect(spy).toHaveBeenCalled();
    expect(document.getElementById('sb-total').textContent).toContain('89');
  });

  test('sbCycleStatus cycles through statuses and renders', () => {
    sbAddRow();
    const id = loadServerBuild()[0].id;
    expect(loadServerBuild()[0].status).toBe('выбираю');
    spy.mockClear();
    sbCycleStatus(id);
    expect(loadServerBuild()[0].status).toBe('выбрано');
    expect(spy).toHaveBeenCalled();
  });

  test('sbAddModel creates model and renders', () => {
    spy.mockClear();
    sbAddModel();
    expect(loadServerModels()).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });

  test('sbDeleteModel removes and renders', () => {
    sbAddModel();
    spy.mockClear();
    sbDeleteModel(loadServerModels()[0].id);
    expect(loadServerModels()).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  test('sbUpdateModel updates field and renders', () => {
    sbAddModel();
    const id = loadServerModels()[0].id;
    spy.mockClear();
    sbUpdateModel(id, 'name', 'Qwen 2.5 32B');
    expect(loadServerModels()[0].name).toBe('Qwen 2.5 32B');
    expect(spy).toHaveBeenCalled();
  });

  test('renderServerBuild shows empty state', () => {
    spy.mockClear();
    renderServerBuild();
    expect(document.getElementById('sb-table-wrap').textContent).toContain('Нет компонентов');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  Scratchpad
// ═══════════════════════════════════════════════════════════════════════════
describe('Scratchpad — CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
    global.renderProdStats = jest.fn();
    document.body.innerHTML = `
      ${todoDom}
      <textarea id="scratchpad-textarea">Line one\nLine two</textarea>
      <div id="scratchpad-status"></div>
      <div id="scratchpad-history" style="display:none"></div>
    `;
  });

  test('scratchpadToTask creates task from first line', () => {
    scratchpadToTask();
    const tasks = loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Line one');
    expect(document.getElementById('scratchpad-textarea').value).toBe('');
  });

  test('scratchpadToTask does nothing with empty textarea', () => {
    document.getElementById('scratchpad-textarea').value = '   ';
    scratchpadToTask();
    expect(loadTasks()).toHaveLength(0);
  });

  test('toggleScratchpadHistory opens and shows empty', () => {
    toggleScratchpadHistory();
    const panel = document.getElementById('scratchpad-history');
    expect(panel.style.display).toBe('');
    expect(panel.textContent).toContain('Пока пусто');
  });

  test('toggleScratchpadHistory toggles closed', () => {
    toggleScratchpadHistory(); // open
    toggleScratchpadHistory(); // close
    expect(document.getElementById('scratchpad-history').style.display).toBe('none');
  });
});
