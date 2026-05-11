const { loadCore, loadWidget } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  global.renderProdStats = jest.fn();
  global.sendNotification = jest.fn();
  global.localDateStr = (d) => d.toISOString().slice(0, 10);
  loadCore();
  loadWidget('todo.js');
});

const todoDomHtml = `
  <span id="todo-done-count">0</span>
  <span id="todo-total-count">0</span>
  <div id="todo-list"></div>
  <div id="history-panel"><div id="history-list"></div></div>
`;

describe('TODO — load / save', () => {
  test('loadTasks returns empty array when no data', () => {
    expect(loadTasks()).toEqual([]);
  });

  test('saveTasks / loadTasks roundtrip', () => {
    const tasks = [{ id: '1', text: 'Test', done: false }];
    saveTasks(tasks);
    expect(loadTasks()).toEqual(tasks);
  });

  test('loadHistory returns empty array when no data', () => {
    expect(loadHistory()).toEqual([]);
  });

  test('saveHistory / loadHistory roundtrip', () => {
    const history = [{ id: '1', text: 'Done', workedMs: 60000 }];
    saveHistory(history);
    expect(loadHistory()).toEqual(history);
  });
});

describe('TODO — addTask()', () => {
  beforeEach(() => { document.body.innerHTML = todoDomHtml; });

  test('adds task with correct structure', () => {
    addTask('Buy milk');
    const tasks = loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Buy milk');
    expect(tasks[0].done).toBe(false);
    expect(tasks[0].current).toBe(false);
    expect(tasks[0].id).toBeTruthy();
    expect(tasks[0].addedAt).toBeTruthy();
    expect(tasks[0].addedDate).toBe(todayStr());
  });

  test('trims whitespace from text', () => {
    addTask('  spaced  ');
    const tasks = loadTasks();
    const last = tasks[tasks.length - 1];
    expect(last.text).toBe('spaced');
  });

  test('appends to existing tasks', () => {
    addTask('Task 1');
    addTask('Task 2');
    expect(loadTasks()).toHaveLength(2);
  });
});

describe('TODO — toggleTask()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = todoDomHtml;
  });

  test('marks task as done and moves to history', () => {
    addTask('Complete me');
    const taskId = loadTasks()[0].id;

    toggleTask(taskId);

    const tasks = loadTasks();
    expect(tasks).toHaveLength(0); // removed from tasks

    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].text).toBe('Complete me');
    expect(history[0].doneAt).toBeTruthy();
    expect(history[0].workedMs).toBeGreaterThanOrEqual(0);
  });

  test('does nothing for non-existent task', () => {
    addTask('Keep me');
    toggleTask('nonexistent');
    expect(loadTasks()).toHaveLength(1);
  });
});

describe('TODO — deleteTask()', () => {
  beforeEach(() => { document.body.innerHTML = todoDomHtml; });

  test('removes task by id', () => {
    addTask('To delete');
    addTask('To keep');
    const tasks = loadTasks();
    deleteTask(tasks[0].id);

    const remaining = loadTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('To keep');
  });
});

describe('TODO — setCurrentTask()', () => {
  beforeEach(() => { document.body.innerHTML = todoDomHtml; });

  test('sets current flag and moves task to top', () => {
    addTask('First');
    addTask('Second');
    const tasks = loadTasks();
    const secondId = tasks[1].id;

    setCurrentTask(secondId);

    const updated = loadTasks();
    expect(updated[0].id).toBe(secondId);
    expect(updated[0].current).toBe(true);
    expect(updated[1].current).toBe(false);
  });

  test('toggles off current when clicked again', () => {
    addTask('Only');
    const taskId = loadTasks()[0].id;

    setCurrentTask(taskId);
    expect(loadTasks()[0].current).toBe(true);

    setCurrentTask(taskId);
    expect(loadTasks()[0].current).toBe(false);
  });
});

describe('TODO — clearHistory()', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="history-list"></div>';
  });

  test('clears all history', () => {
    saveHistory([{ id: '1', text: 'Old' }]);
    global.confirm = jest.fn(() => true);

    clearHistory();

    expect(loadHistory()).toEqual([]);
  });

  test('does not clear if user cancels confirm', () => {
    saveHistory([{ id: '1', text: 'Keep' }]);
    global.confirm = jest.fn(() => false);

    clearHistory();

    expect(loadHistory()).toHaveLength(1);
  });
});

describe('TODO — renderTodo()', () => {
  beforeEach(() => {
    document.body.innerHTML = todoDomHtml;
    localStorage.clear();
  });

  test('renders empty state when no tasks', () => {
    renderTodo();
    expect(document.getElementById('todo-list').innerHTML).toContain('Все задачи выполнены');
  });

  test('renders task items', () => {
    addTask('Render me');
    renderTodo();
    const list = document.getElementById('todo-list');
    expect(list.querySelectorAll('.todo-item').length).toBe(1);
    expect(list.textContent).toContain('Render me');
  });

  test('shows correct counters', () => {
    addTask('Task A');
    addTask('Task B');
    renderTodo();
    expect(document.getElementById('todo-total-count').textContent).toBe('2');
    expect(document.getElementById('todo-done-count').textContent).toBe('0');
  });
});
