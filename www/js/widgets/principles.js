'use strict';

// ── Principles ───────────────────────────────────────────────────────────
const PRINCIPLES_KEY = 'prod_principles_v1';

function loadPrinciples() { return loadJSON(PRINCIPLES_KEY, null); }

function savePrinciples(list) {
  localStorage.setItem(PRINCIPLES_KEY, JSON.stringify(list));
}

function getPrinciples() {
  return loadPrinciples() || getDefault('prod_principles_v1') || [];
}

let _editingPrincipleId = null;

function renderPrinciples() {
  const list = document.getElementById('principles-list');
  if (!list) return;
  const principles = getPrinciples();
  list.innerHTML = principles.map(p => `
    <div class="principle p-${escHtml(p.color)}">
      <div class="principle-icon">${escHtml(p.icon)}</div>
      <div class="principle-text">
        <strong>${escHtml(p.title)}</strong>
        <span>${escHtml(p.desc)}</span>
      </div>
      <div class="principle-actions">
        <button class="principle-edit-btn" onclick="editPrinciple('${p.id}')" title="Редактировать">✏️</button>
        <button class="principle-del-btn" onclick="deletePrinciple('${p.id}')" title="Удалить">✕</button>
      </div>
    </div>`).join('');
}

function showPrincipleForm() {
  _editingPrincipleId = null;
  document.getElementById('principle-icon-input').value = '🎯';
  document.getElementById('principle-title-input').value = '';
  document.getElementById('principle-desc-input').value = '';
  document.getElementById('principle-color-input').value = 'red';
  document.getElementById('principle-form').style.display = '';
  document.getElementById('principle-add-row').style.display = 'none';
  document.getElementById('principle-title-input').focus();
}

function editPrinciple(id) {
  const principles = getPrinciples();
  const p = principles.find(x => x.id === id);
  if (!p) return;
  _editingPrincipleId = id;
  document.getElementById('principle-icon-input').value = p.icon;
  document.getElementById('principle-title-input').value = p.title;
  document.getElementById('principle-desc-input').value = p.desc;
  document.getElementById('principle-color-input').value = p.color;
  document.getElementById('principle-form').style.display = '';
  document.getElementById('principle-add-row').style.display = 'none';
  document.getElementById('principle-title-input').focus();
}

function savePrincipleForm() {
  const icon  = document.getElementById('principle-icon-input').value.trim() || '🎯';
  const title = document.getElementById('principle-title-input').value.trim();
  const desc  = document.getElementById('principle-desc-input').value.trim();
  const color = document.getElementById('principle-color-input').value;
  if (!title) return;
  const principles = getPrinciples();
  if (_editingPrincipleId) {
    const idx = principles.findIndex(x => x.id === _editingPrincipleId);
    if (idx !== -1) {
      principles[idx] = { id: _editingPrincipleId, icon: icon, title: title, desc: desc, color: color };
    }
  } else {
    principles.push({ id: uid(), icon: icon, title: title, desc: desc, color: color });
  }
  savePrinciples(principles);
  cancelPrincipleForm();
  renderPrinciples();
}

function cancelPrincipleForm() {
  _editingPrincipleId = null;
  document.getElementById('principle-form').style.display = 'none';
  document.getElementById('principle-add-row').style.display = '';
}

function deletePrinciple(id) {
  if (!confirm('Удалить этот принцип?')) return;
  const principles = getPrinciples();
  savePrinciples(principles.filter(x => x.id !== id));
  renderPrinciples();
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'principles',
  render: renderPrinciples,
});
