const { loadCore, loadWidget, applyWidgetConfigSync } = require('../helpers');

beforeAll(() => {
  global.getCurrentUser = jest.fn(() => ({ username: 'test', role: 'admin', permissions: ['dashboard', 'widget_settings'] }));
  global.dayOff = false;
  loadCore();
  loadWidget('key-skills.js');
  applyWidgetConfigSync();
});

const keySkillsDom = `
  <div id="key-skills-list"></div>
  <div id="key-skills-add-row"></div>
  <div id="key-skills-picker" style="display:none">
    <select id="key-skills-select"></select>
  </div>
`;

describe('Key Skills — load / save', () => {
  beforeEach(() => { localStorage.clear(); });

  test('loadKeySkills returns empty array when no data', () => {
    expect(loadKeySkills()).toEqual([]);
  });

  test('saveKeySkills / loadKeySkills roundtrip', () => {
    const skills = [{ id: 1, name: 'Go', category: 'Язык программирования' }];
    saveKeySkills(skills);
    expect(loadKeySkills()).toEqual(skills);
  });
});

describe('Key Skills — removeKeySkill()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = keySkillsDom;
  });

  test('removes skill by id', () => {
    saveKeySkills([
      { id: 1, name: 'Go', category: 'Язык программирования' },
      { id: 2, name: 'PostgreSQL', category: 'База данных' },
    ]);
    global.confirm = jest.fn(() => true);
    removeKeySkill(1);
    const skills = loadKeySkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('PostgreSQL');
  });

  test('does not remove if user cancels', () => {
    saveKeySkills([{ id: 1, name: 'Go', category: 'Язык программирования' }]);
    global.confirm = jest.fn(() => false);
    removeKeySkill(1);
    expect(loadKeySkills()).toHaveLength(1);
  });
});

describe('Key Skills — renderKeySkills()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = keySkillsDom;
  });

  test('renders empty list', () => {
    renderKeySkills();
    expect(document.getElementById('key-skills-list').innerHTML).toBe('');
  });

  test('renders skills', () => {
    saveKeySkills([
      { id: 1, name: 'Go', category: 'Язык программирования' },
      { id: 2, name: 'PostgreSQL', category: 'База данных' },
    ]);
    renderKeySkills();
    const list = document.getElementById('key-skills-list');
    expect(list.querySelectorAll('.principle').length).toBe(2);
    expect(list.textContent).toContain('Go');
    expect(list.textContent).toContain('PostgreSQL');
  });
});

describe('Key Skills — addSelectedKeySkill()', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = keySkillsDom;
    _keySkillsCache = [
      { id: 10, name: 'Docker', category: 'Инструмент' },
      { id: 20, name: 'React', category: 'Фреймворк' },
    ];
  });

  test('adds selected skill', () => {
    document.getElementById('key-skills-select').innerHTML = '<option value="10">Docker</option>';
    document.getElementById('key-skills-select').value = '10';
    addSelectedKeySkill();
    const skills = loadKeySkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('Docker');
  });

  test('does not add duplicate', () => {
    saveKeySkills([{ id: 10, name: 'Docker', category: 'Инструмент' }]);
    document.getElementById('key-skills-select').value = '10';
    addSelectedKeySkill();
    expect(loadKeySkills()).toHaveLength(1);
  });
});

describe('Key Skills — registration', () => {
  test('registers with correct id', () => {
    const widget = window.WidgetRegistry.find(w => w.id === 'key-skills');
    expect(widget).toBeTruthy();
  });
});
