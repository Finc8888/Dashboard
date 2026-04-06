'use strict';

// ── Key Skills ──────────────────────────────────────────────────────────────
const KEY_SKILLS_KEY = 'prod_key_skills_v1';

function loadKeySkills() { return loadJSON(KEY_SKILLS_KEY, []); }

function saveKeySkills(list) {
  localStorage.setItem(KEY_SKILLS_KEY, JSON.stringify(list));
}

const SKILL_CAT_COLORS = {
  'Язык программирования': 'blue',
  'База данных': 'green',
  'Фреймворк': 'yellow',
  'Инструмент': 'purple',
  'Другое': 'cyan',
};

function renderKeySkills() {
  const list = document.getElementById('key-skills-list');
  if (!list) return;
  const skills = loadKeySkills();
  list.innerHTML = skills.map(s => `
    <div class="principle p-${SKILL_CAT_COLORS[s.category] || 'cyan'}">
      <div class="principle-icon">${escHtml(s.category === 'Язык программирования' ? '💻' : s.category === 'База данных' ? '🗄️' : s.category === 'Фреймворк' ? '🧩' : s.category === 'Инструмент' ? '🔧' : '📦')}</div>
      <div class="principle-text">
        <strong>${escHtml(s.name)}</strong>
        <span>${escHtml(s.category)}</span>
        <a href="/jobs/skills/${s.id}" class="key-skill-link" target="_blank">Открыть в Jobs →</a>
      </div>
      <div class="principle-actions">
        <button class="principle-del-btn" onclick="removeKeySkill(${s.id})" title="Удалить">✕</button>
      </div>
    </div>`).join('');
}

let _keySkillsCache = null;

function showKeySkillPicker() {
  document.getElementById('key-skills-picker').style.display = '';
  document.getElementById('key-skills-add-row').style.display = 'none';

  const sel = document.getElementById('key-skills-select');
  sel.innerHTML = '<option value="">Загрузка...</option>';

  fetch('/jobs/api/v1/skills', { credentials: 'include' })
    .then(r => r.json())
    .then(allSkills => {
      _keySkillsCache = allSkills;
      const existing = loadKeySkills().map(s => s.id);
      const available = allSkills.filter(s => !existing.includes(s.id));
      sel.innerHTML = '<option value="">Выберите навык...</option>' +
        available.map(s => `<option value="${s.id}">${escHtml(s.name)} (${escHtml(s.category)})</option>`).join('');
    })
    .catch(() => {
      sel.innerHTML = '<option value="">Ошибка загрузки</option>';
    });
}

function addSelectedKeySkill() {
  const sel = document.getElementById('key-skills-select');
  const id = parseInt(sel.value);
  if (!id || !_keySkillsCache) return;

  const skill = _keySkillsCache.find(s => s.id === id);
  if (!skill) return;

  const skills = loadKeySkills();
  if (skills.some(s => s.id === id)) return;

  skills.push({ id: skill.id, name: skill.name, category: skill.category });
  saveKeySkills(skills);
  cancelKeySkillPicker();
  renderKeySkills();
}

function removeKeySkill(id) {
  if (!confirm('Удалить навык из списка?')) return;
  saveKeySkills(loadKeySkills().filter(s => s.id !== id));
  renderKeySkills();
}

function cancelKeySkillPicker() {
  document.getElementById('key-skills-picker').style.display = 'none';
  document.getElementById('key-skills-add-row').style.display = '';
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'key-skills',
  render: renderKeySkills,
});
