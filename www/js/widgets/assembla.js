'use strict';

// ── Assembla Tickets Widget ────────────────────────────────────────────────
const ASSEMBLA_CFG_KEY = 'prod_assembla_config_v1';
const ASSEMBLA_PROXY   = 'http://localhost:3131';

const _aS = {
  tickets: [],
  currentTicket: null,
  currentUser: null,
  members: {},
  statuses: [],
  loading: false,
};

function _aCfg()       { return loadJSON(ASSEMBLA_CFG_KEY, {}); }
function _aSaveCfg(v)  { localStorage.setItem(ASSEMBLA_CFG_KEY, JSON.stringify(v)); }

// ── API helper ────────────────────────────────────────────────────────────
async function _aApi(path, opts = {}) {
  const cfg = _aCfg();
  const res = await fetch(ASSEMBLA_PROXY + '/api' + path, {
    method: opts.method || 'GET',
    headers: {
      'X-Api-Key':    cfg.apiKey    || '',
      'X-Api-Secret': cfg.apiSecret || '',
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Members ───────────────────────────────────────────────────────────────
async function _aFetchUser(id) {
  if (!id) return '—';
  if (_aS.members[id]) return _aS.members[id];
  try {
    const u = await _aApi(`/users/${id}`);
    const name = u.name || u.login || id;
    _aS.members[id] = name;
    return name;
  } catch {
    _aS.members[id] = id;
    return id;
  }
}

function _aMemberName(id) { return _aS.members[id] || id || '—'; }

// ── Status helpers ────────────────────────────────────────────────────────
function _aStatusClass(s) {
  const sl = (s || '').toLowerCase();
  if (sl.includes('progress') || sl.includes('in ')) return 'a-s-prog';
  if (sl.includes('new'))                              return 'a-s-new';
  if (sl.includes('test') || sl.includes('review'))   return 'a-s-test';
  if (sl.includes('fixed') || sl.includes('done'))    return 'a-s-done';
  if (sl.includes('closed') || sl.includes('invalid')) return 'a-s-closed';
  return 'a-s-default';
}

function _aPriorityLabel(p) {
  return (['', '🔴', '🟠', '🟡', '🟢', '⚪'])[p || 3] || '⚪';
}

function _aCollectStatuses(tickets) {
  const seen = new Set(_aS.statuses.map(s => s.name));
  tickets.forEach(t => { if (t.status) seen.add(t.status); });
  _aS.statuses = [...seen].sort().map(name => ({ name }));
}

// ── Load tickets ──────────────────────────────────────────────────────────
async function _aLoadCurrentUser() {
  if (_aS.currentUser) return;
  try {
    _aS.currentUser = await _aApi('/user');
    if (_aS.currentUser?.id) {
      _aS.members[_aS.currentUser.id] = _aS.currentUser.name || _aS.currentUser.login;
    }
  } catch { _aS.currentUser = null; }
}

async function aLoadTickets() {
  const cfg = _aCfg();
  if (!cfg.apiKey || !cfg.spaceId) { renderAssembla(); return; }

  const container = document.getElementById('a-ticket-list');
  if (container) container.innerHTML = '<div class="a-loading"><span class="a-spinner"></span> Загрузка...</div>';

  const reportEl = document.getElementById('a-filter-report');
  const statusEl = document.getElementById('a-filter-status');
  const searchEl = document.getElementById('a-search');
  const sortEl   = document.getElementById('a-filter-sort');

  const report = reportEl ? reportEl.value : 'all';
  const status = statusEl ? statusEl.value : '';
  const search = searchEl ? searchEl.value.trim() : '';
  const sort   = sortEl   ? sortEl.value   : 'updated';

  if (report === 'mine' || report === 'followed') await _aLoadCurrentUser();

  const params = new URLSearchParams({
    per_page: 100, page: 1, report: '0',
    sort_by: 'updated_at', sort_order: 'desc',
  });
  if (search) params.set('term', search);

  try {
    const all = await _aApi(`/spaces/${cfg.spaceId}/tickets?${params}`);
    const arr = Array.isArray(all) ? all : [];
    _aCollectStatuses(arr);

    const uid = _aS.currentUser?.id;
    let filtered = arr;

    if (report === 'mine')     filtered = filtered.filter(t => t.assigned_to_id === uid);
    if (report === 'followed') filtered = filtered.filter(t => {
      const nl = t.notification_list;
      if (Array.isArray(nl)) return nl.includes(uid);
      if (typeof nl === 'string') return nl.split(',').map(x => x.trim()).includes(uid);
      return false;
    });
    if (status) filtered = filtered.filter(t => (t.status || '').toLowerCase() === status.toLowerCase());
    if (sort === 'priority') filtered.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    else if (sort === 'number') filtered.sort((a, b) => b.number - a.number);
    else filtered.sort((a, b) => new Date(b.updated_on || 0) - new Date(a.updated_on || 0));

    _aS.tickets = filtered;
    _aUpdateStatusFilter();
    _aRenderTicketList();
  } catch (e) {
    if (container) container.innerHTML = `<div class="a-error">${escHtml(e.message)}</div>`;
  }
}

function _aUpdateStatusFilter() {
  const el = document.getElementById('a-filter-status');
  if (!el) return;
  const cur = el.value;
  const options = _aS.statuses.map(s => `<option value="${escHtml(s.name)}" ${s.name === cur ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('');
  el.innerHTML = `<option value="">Все статусы</option>${options}`;
}

// ── Render ticket list ────────────────────────────────────────────────────
function _aRenderTicketList() {
  const container = document.getElementById('a-ticket-list');
  if (!container) return;

  const tickets = _aS.tickets;
  if (!tickets.length) {
    container.innerHTML = '<div class="a-empty">Тикетов не найдено</div>';
    return;
  }

  container.innerHTML = tickets.map(t => {
    const sc = _aStatusClass(t.status);
    const updated = t.updated_on ? new Date(t.updated_on).toLocaleDateString('ru') : '';
    return `
      <div class="a-ticket-row" data-num="${t.number}" onclick="aOpenTicket(${t.number}, this)">
        <span class="a-prio-dot a-p${t.priority || 3}" title="Приоритет ${t.priority || 3}"></span>
        <div class="a-ticket-info">
          <div class="a-ticket-title">${escHtml(t.summary || '')}</div>
          <div class="a-ticket-meta">
            <span class="a-num">#${t.number}</span>
            <span class="a-badge ${sc}">${escHtml(t.status || '?')}</span>
            ${updated ? `<span class="a-date">${updated}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Open ticket detail ────────────────────────────────────────────────────
async function aOpenTicket(num, el) {
  document.querySelectorAll('.a-ticket-row').forEach(r => r.classList.remove('a-active'));
  if (el) el.classList.add('a-active');

  const panel = document.getElementById('a-detail-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  panel.innerHTML = '<div class="a-loading" style="padding:24px"><span class="a-spinner"></span> Загрузка...</div>';

  const cfg = _aCfg();
  try {
    const [ticket, comments] = await Promise.all([
      _aApi(`/spaces/${cfg.spaceId}/tickets/${num}`),
      _aApi(`/spaces/${cfg.spaceId}/tickets/${num}/ticket_comments?per_page=100`).catch(() => []),
    ]);
    _aS.currentTicket = ticket;
    await Promise.all([_aFetchUser(ticket.assigned_to_id), _aFetchUser(ticket.reporter_id)]);
    if (ticket.status && !_aS.statuses.length) {
      _aS.statuses = [{ name: ticket.status }];
    }
    const filtered = (Array.isArray(comments) ? comments : [])
      .filter(c => (c.comment && c.comment.trim()) || c.ticket_changes)
      .sort((a, b) => new Date(a.created_on) - new Date(b.created_on));
    _aRenderDetail(ticket, filtered);
  } catch (e) {
    panel.innerHTML = `<div class="a-error" style="padding:16px">${escHtml(e.message)}</div>`;
  }
}

function aCloseDetail() {
  const panel = document.getElementById('a-detail-panel');
  if (panel) panel.style.display = 'none';
  document.querySelectorAll('.a-ticket-row').forEach(r => r.classList.remove('a-active'));
  _aS.currentTicket = null;
}

// ── Status change ─────────────────────────────────────────────────────────
async function aChangeStatus(newStatus) {
  const t = _aS.currentTicket;
  if (!t) return;
  const sel = document.getElementById('a-status-select');
  if (sel) sel.disabled = true;
  const cfg = _aCfg();
  try {
    await _aApi(`/spaces/${cfg.spaceId}/tickets/${t.number}`, {
      method: 'PUT',
      body: { ticket: { status: newStatus } },
    });
    await aOpenTicket(t.number, null);
    await aLoadTickets();
  } catch (e) {
    if (sel) sel.disabled = false;
    showToast('Ошибка: ' + e.message);
  }
}

// ── parseChanges ──────────────────────────────────────────────────────────
function _aParseChanges(raw) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed === '--- []' || trimmed === '---') return [];
  const labels = {
    status: 'Статус', assigned_to_id: 'Назначен', priority: 'Приоритет',
    milestone_id: 'Milestone', summary: 'Заголовок',
  };
  const result = [];
  let current = null;
  for (const line of trimmed.split('\n').map(l => l.trimEnd())) {
    if (line === '---' || !line.trim()) continue;
    if (line.startsWith('- - ')) { current = { field: line.slice(4).trim(), values: [] }; result.push(current); }
    else if (/^  - /.test(line) && current) current.values.push(line.slice(4).trim());
  }
  return result.map(({ field, values }) => {
    const label = labels[field] || field;
    const [from, to] = values;
    if (from != null && to != null) return `<span class="a-change-pill"><b>${escHtml(label)}:</b> ${escHtml(from)} → ${escHtml(to)}</span>`;
    if (to   != null) return `<span class="a-change-pill"><b>${escHtml(label)}:</b> ${escHtml(to)}</span>`;
    return '';
  }).filter(Boolean);
}

// ── Render detail ─────────────────────────────────────────────────────────
function _aRenderStatusSelect(current) {
  const sc = _aStatusClass(current);
  if (!_aS.statuses.length) {
    return `<span class="a-badge ${sc}">${escHtml(current || '?')}</span>`;
  }
  const options = _aS.statuses.map(s => {
    const n = s.name || s;
    return `<option value="${escHtml(n)}" ${n === current ? 'selected' : ''}>${escHtml(n)}</option>`;
  }).join('');
  return `<select id="a-status-select" class="a-status-sel ${sc}" onchange="aChangeStatus(this.value)">${options}</select>`;
}

function _aRenderDetail(t, comments) {
  const panel = document.getElementById('a-detail-panel');
  if (!panel) return;
  const cfg = _aCfg();
  const created = t.created_on ? new Date(t.created_on).toLocaleString('ru') : '—';
  const updated = t.updated_on ? new Date(t.updated_on).toLocaleString('ru') : '—';

  const commentsHtml = comments.length ? comments.map(c => {
    const changes = _aParseChanges(c.ticket_changes);
    const hasText = c.comment && c.comment.trim();
    const isChangeOnly = !hasText && changes.length;
    return `<div class="a-comment${isChangeOnly ? ' a-change-only' : ''}">
      <div class="a-cmt-header">
        <span class="a-cmt-author">${escHtml(c.user_name || c.author || '?')}</span>
        <span class="a-cmt-date">${c.created_on ? new Date(c.created_on).toLocaleString('ru') : ''}</span>
      </div>
      ${hasText ? `<div class="a-cmt-body">${escHtml(c.comment)}</div>` : ''}
      ${changes.length ? `<div class="a-cmt-changes">${changes.join('')}</div>` : ''}
    </div>`;
  }).join('') : '<div class="a-empty" style="font-size:12px;padding:8px 0">Комментариев нет</div>';

  panel.innerHTML = `
    <div class="a-detail-header">
      <div class="a-detail-num">#${t.number} ${_aRenderStatusSelect(t.status)}</div>
      <div class="a-detail-actions">
        <a class="a-btn-sec" href="https://app.assembla.com/spaces/${cfg.spaceId}/tickets/${t.number}" target="_blank" rel="noopener">↗</a>
        <button class="a-btn-sec" onclick="aCloseDetail()">✕</button>
      </div>
    </div>
    <div class="a-detail-title">${escHtml(t.summary || '')}</div>
    <div class="a-detail-meta">
      <span>${_aPriorityLabel(t.priority)} Приоритет ${t.priority || '?'}</span>
      <span>👤 ${escHtml(_aMemberName(t.assigned_to_id))}</span>
      <span>✍ ${escHtml(_aMemberName(t.reporter_id))}</span>
      ${t.milestone_name ? `<span>🏁 ${escHtml(t.milestone_name)}</span>` : ''}
      <span>🕐 ${updated}</span>
    </div>
    ${t.description ? `<div class="a-detail-desc">${escHtml(t.description)}</div>` : ''}
    <div class="a-section-title">Комментарии (${comments.length})</div>
    <div class="a-comments-list">${commentsHtml}</div>
    <div class="a-comment-form">
      <textarea class="a-cmt-input" id="a-new-comment" placeholder="Добавить комментарий…" rows="3"></textarea>
      <button class="a-btn-primary" onclick="aSubmitComment()">Отправить</button>
    </div>
  `;
}

// ── Submit comment ────────────────────────────────────────────────────────
async function aSubmitComment() {
  const t = _aS.currentTicket;
  if (!t) return;
  const el = document.getElementById('a-new-comment');
  if (!el) return;
  const text = el.value.trim();
  if (!text) return;
  const cfg = _aCfg();
  el.disabled = true;
  try {
    await _aApi(`/spaces/${cfg.spaceId}/tickets/${t.number}/ticket_comments`, {
      method: 'POST',
      body: { ticket_comment: { comment: text } },
    });
    await aOpenTicket(t.number, null);
  } catch (e) {
    showToast('Ошибка: ' + e.message);
    el.disabled = false;
  }
}

// ── Settings modal ────────────────────────────────────────────────────────
function aOpenSettings() {
  const modal = document.getElementById('a-settings-modal');
  if (!modal) return;
  const cfg = _aCfg();
  document.getElementById('a-cfg-key').value    = cfg.apiKey    || '';
  document.getElementById('a-cfg-secret').value = cfg.apiSecret || '';
  document.getElementById('a-cfg-space').value  = cfg.spaceId   || '';
  modal.style.display = 'flex';
}

function aCloseSettings() {
  const modal = document.getElementById('a-settings-modal');
  if (modal) modal.style.display = 'none';
}

function aSaveSettings() {
  const cfg = {
    apiKey:    document.getElementById('a-cfg-key').value.trim(),
    apiSecret: document.getElementById('a-cfg-secret').value.trim(),
    spaceId:   document.getElementById('a-cfg-space').value.trim(),
  };
  _aSaveCfg(cfg);
  aCloseSettings();
  _aS.currentUser = null;
  _aS.members = {};
  _aS.statuses = [];
  aLoadTickets();
}

// ── Main render ───────────────────────────────────────────────────────────
function renderAssembla() {
  const cfg = _aCfg();
  const container = document.getElementById('a-ticket-list');
  if (!container) return;

  if (!cfg.apiKey || !cfg.spaceId) {
    container.innerHTML = '<div class="a-empty">Настройте API ключи для подключения к Assembla.<br><button class="a-btn-primary" style="margin-top:10px" onclick="aOpenSettings()">⚙ Настройки</button></div>';
    return;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function _aInit() {
  const cfg = _aCfg();
  if (cfg.apiKey && cfg.spaceId) aLoadTickets();
  else renderAssembla();

  // debounced search
  const searchEl = document.getElementById('a-search');
  if (searchEl) {
    let _t;
    searchEl.addEventListener('input', () => {
      clearTimeout(_t);
      _t = setTimeout(aLoadTickets, 400);
    });
    searchEl.addEventListener('keydown', e => { if (e.key === 'Enter') aLoadTickets(); });
  }
}

// ── Registration ──────────────────────────────────────────────────────────
registerWidget({
  id: 'assembla',
  render: renderAssembla,
  init: _aInit,
});
