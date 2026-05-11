'use strict';

// ── Server Build Widget ─────────────────────────────────────────────────────
const SB_KEY = 'prod_server_build_v1';
const SB_STATUSES = ['выбираю', 'выбрано', 'в корзине', 'заказано', 'куплено'];
const SB_MODELS_KEY = 'prod_server_models_v1';

function loadServerBuild() { return loadJSON(SB_KEY, []); }
function saveServerBuild(d) { localStorage.setItem(SB_KEY, JSON.stringify(d)); }
function loadServerModels() { return loadJSON(SB_MODELS_KEY, []); }
function saveServerModels(d) { localStorage.setItem(SB_MODELS_KEY, JSON.stringify(d)); }

function sbAddRow() {
  const rows = loadServerBuild();
  rows.push({ id: uid(), component: '', model: '', price: '', link: '', status: 'выбираю' });
  saveServerBuild(rows);
  renderServerBuild();
}

function sbDeleteRow(id) {
  if (!confirm('Удалить компонент?')) return;
  saveServerBuild(loadServerBuild().filter(r => r.id !== id));
  renderServerBuild();
}

function sbUpdateField(id, field, value) {
  const rows = loadServerBuild();
  const row = rows.find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  saveServerBuild(rows);
  renderServerBuild();
}

function sbUpdateTotal() {
  const rows = loadServerBuild();
  const total = rows.reduce((sum, r) => {
    const n = parseInt(String(r.price).replace(/[^\d]/g, ''), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const el = document.getElementById('sb-total');
  if (el) el.textContent = total > 0 ? '~' + total.toLocaleString('ru-RU') + ' ₽' : '';
}

function sbCycleStatus(id) {
  const rows = loadServerBuild();
  const row = rows.find(r => r.id === id);
  if (!row) return;
  const idx = SB_STATUSES.indexOf(row.status);
  row.status = SB_STATUSES[(idx + 1) % SB_STATUSES.length];
  saveServerBuild(rows);
  renderServerBuild();
}

function sbAddModel() {
  const models = loadServerModels();
  models.push({ id: uid(), name: '', size: '', vram: '', speed: '', quality: '' });
  saveServerModels(models);
  renderServerBuild();
}

function sbDeleteModel(id) {
  saveServerModels(loadServerModels().filter(m => m.id !== id));
  renderServerBuild();
}

function sbUpdateModel(id, field, value) {
  const models = loadServerModels();
  const m = models.find(r => r.id === id);
  if (!m) return;
  m[field] = value;
  saveServerModels(models);
  renderServerBuild();
}

function sbStatusClass(status) {
  const map = { 'выбираю': 'sb-status-choosing', 'выбрано': 'sb-status-chosen', 'в корзине': 'sb-status-cart', 'заказано': 'sb-status-ordered', 'куплено': 'sb-status-bought' };
  return map[status] || '';
}

function renderServerBuild() {
  const rows = loadServerBuild();
  const models = loadServerModels();
  const wrap = document.getElementById('sb-table-wrap');
  const modelsList = document.getElementById('sb-models-list');
  if (!wrap) return;

  // Components table
  if (rows.length === 0) {
    wrap.innerHTML = '<div class="todo-empty">Нет компонентов. Нажмите + чтобы добавить.</div>';
  } else {
    let html = '<table class="sb-table"><thead><tr>' +
      '<th>Компонент</th><th>Модель</th><th>Цена</th><th>Ссылка</th><th>Статус</th><th></th>' +
      '</tr></thead><tbody>';
    rows.forEach(r => {
      const sc = sbStatusClass(r.status);
      html += `<tr data-sb-id="${r.id}">
        <td><input class="sb-input" value="${escHtml(r.component)}" onchange="sbUpdateField('${r.id}','component',this.value)" placeholder="GPU, CPU…"></td>
        <td><input class="sb-input sb-input-wide" value="${escHtml(r.model)}" onchange="sbUpdateField('${r.id}','model',this.value)" placeholder="Название"></td>
        <td><input class="sb-input sb-input-sm" value="${escHtml(r.price)}" onchange="sbUpdateField('${r.id}','price',this.value)" placeholder="₽"></td>
        <td><input class="sb-input" value="${escHtml(r.link)}" onchange="sbUpdateField('${r.id}','link',this.value)" placeholder="URL"></td>
        <td><button class="sb-status-btn ${sc}" onclick="sbCycleStatus('${r.id}')">${escHtml(r.status)}</button></td>
        <td><button class="todo-del" onclick="sbDeleteRow('${r.id}')" title="Удалить">×</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }
  sbUpdateTotal();

  // Ollama models table
  if (!modelsList) return;
  let mHtml = '<table class="sb-table sb-models-table"><thead><tr>' +
    '<th>Модель</th><th>Размер</th><th>VRAM</th><th>Скорость (tok/s)</th><th>Качество</th><th></th>' +
    '</tr></thead><tbody>';
  models.forEach(m => {
    mHtml += `<tr>
      <td><input class="sb-input" value="${escHtml(m.name)}" onchange="sbUpdateModel('${m.id}','name',this.value)" placeholder="Qwen 2.5 32B Q4"></td>
      <td><input class="sb-input sb-input-sm" value="${escHtml(m.size)}" onchange="sbUpdateModel('${m.id}','size',this.value)" placeholder="~20 GB"></td>
      <td><input class="sb-input sb-input-sm" value="${escHtml(m.vram)}" onchange="sbUpdateModel('${m.id}','vram',this.value)" placeholder="20 GB"></td>
      <td><input class="sb-input sb-input-sm" value="${escHtml(m.speed)}" onchange="sbUpdateModel('${m.id}','speed',this.value)" placeholder="20-25"></td>
      <td><input class="sb-input sb-input-sm" value="${escHtml(m.quality)}" onchange="sbUpdateModel('${m.id}','quality',this.value)" placeholder="Отличное"></td>
      <td><button class="todo-del" onclick="sbDeleteModel('${m.id}')" title="Удалить">×</button></td>
    </tr>`;
  });
  mHtml += '</tbody></table>';
  mHtml += '<button class="sb-add-model-btn" onclick="sbAddModel()">+ Добавить модель</button>';
  modelsList.innerHTML = mHtml;
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'server-build',
  render: renderServerBuild,
});
