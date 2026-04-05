'use strict';

// ── Projects Hub ──────────────────────────────────────────────────────────
const PROJECTS = [
  {
    id:    'auth-admin',
    label: 'Админ-панель',
    icon:  '🔐',
    url:   '/admin/',
    desc:  'Auth Gateway · Управление пользователями',
  },
  {
    id:    'gladys-blog',
    label: 'Gladys Blog',
    icon:  '✍️',
    url:   '/blog/',
    desc:  'Hugo · Nginx · Docker',
  },
  {
    id:    'blog-admin',
    label: 'Blog Admin',
    icon:  '📝',
    url:   '/blog-admin/',
    desc:  'Управление постами · Hugo',
  },
  {
    id:    'job-stats',
    label: 'Job Statistics',
    icon:  '📊',
    url:   '/jobs/',
    desc:  'Go API · React · MySQL',
  },
  {
    id:    'gladys-chat',
    label: 'Gladys Chat',
    icon:  '💬',
    url:   '/chat/',
    desc:  'Go · React · E2EE · WebSocket',
  },
  {
    id:    'sketchbook',
    label: 'Sketchbook',
    icon:  '✦',
    url:   '/sketchbook/',
    desc:  'Стихи · Песни · Рецепты',
  },
];

const PROJECT_STATUS = {}; // id → 'checking' | 'online' | 'offline'

const PROJECT_PERMISSIONS = {
  'auth-admin': 'admin',
  'gladys-blog': 'blog',
  'blog-admin': 'admin',
  'job-stats': 'jobs',
  'gladys-chat': 'chat',
  'sketchbook': 'sketchbook',
};

function getVisibleProjects() {
  const user = getCurrentUser();
  if (!user) return [];
  const perms = user.permissions || [];
  return PROJECTS.filter(p => {
    const requiredPerm = PROJECT_PERMISSIONS[p.id];
    return !requiredPerm || perms.includes(requiredPerm);
  });
}

async function checkProject(project) {
  PROJECT_STATUS[project.id] = 'checking';
  renderProjectsNav();
  try {
    const r = await fetch(project.url, { credentials: 'include', signal: AbortSignal.timeout(4000) });
    PROJECT_STATUS[project.id] = r.ok || r.status === 401 ? 'online' : 'offline';
  } catch {
    PROJECT_STATUS[project.id] = 'offline';
  }
  renderProjectsNav();
}

function openProject(project) {
  if (PROJECT_STATUS[project.id] === 'offline') {
    showProjectOfflineMsg(project.id);
    return;
  }
  window.location.href = project.url;
}

function showProjectOfflineMsg(projectId) {
  const msgEl = document.getElementById('proj-msg-' + projectId);
  if (!msgEl) return;
  msgEl.style.display = '';
  clearTimeout(msgEl._hideTimer);
  msgEl._hideTimer = setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
}

function renderProjectsNav() {
  const list = document.getElementById('projects-nav-list');
  if (!list) return;
  const visible = getVisibleProjects();
  list.innerHTML = visible.map(p => {
    const status = PROJECT_STATUS[p.id] || 'checking';
    const dotCls = status === 'online' ? 'proj-dot-online'
                 : status === 'offline' ? 'proj-dot-offline'
                 : 'proj-dot-checking';
    return `
      <div class="proj-item">
        <button class="proj-btn" onclick="openProject(PROJECTS.find(p=>p.id==='${p.id}'))">
          <span class="proj-dot ${dotCls}"></span>
          <span class="proj-icon">${p.icon}</span>
          <span class="proj-label">${p.label}</span>
          <span class="proj-desc">${p.desc}</span>
        </button>
        <div class="proj-offline-msg" id="proj-msg-${p.id}" style="display:none">
          Проект недоступен — запустите Docker-контейнер
        </div>
      </div>`;
  }).join('');
}

let _projectsIntervalId = null;

function initProjectsNav() {
  renderProjectsNav();
  const visible = getVisibleProjects();
  visible.forEach(p => checkProject(p));
  if (_projectsIntervalId) clearInterval(_projectsIntervalId);
  _projectsIntervalId = setInterval(() => {
    const vis = getVisibleProjects();
    vis.forEach(p => checkProject(p));
  }, 30000);
}
