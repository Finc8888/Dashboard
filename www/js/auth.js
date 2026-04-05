'use strict';

const AUTH_API = '/api/auth';
let currentUser = null;

async function checkAuth() {
  try {
    const r = await fetch(AUTH_API + '/me', { credentials: 'include' });
    if (!r.ok) { currentUser = null; return false; }
    currentUser = await r.json();
    return true;
  } catch { currentUser = null; return false; }
}

async function doLogin(email, password) {
  const r = await fetch(AUTH_API + '/login', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Ошибка входа'); }
  const data = await r.json();
  currentUser = data.user;
  return data;
}

async function doRegister(username, email, password) {
  const r = await fetch(AUTH_API + '/register', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Ошибка регистрации'); }
  const data = await r.json();
  currentUser = data.user;
  return data;
}

async function doLogout() {
  await fetch(AUTH_API + '/logout', { method: 'POST', credentials: 'include' });
  currentUser = null;
  showAuthOverlay();
}

function getCurrentUser() { return currentUser; }

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.querySelector('.eye-icon').style.display = isHidden ? 'none' : '';
  btn.querySelector('.eye-off-icon').style.display = isHidden ? '' : 'none';
}

function showAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('main-content').style.display = 'none';
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
}

// Render login/register form with tab switch
function renderAuthForm() {
  const overlay = document.getElementById('auth-overlay');
  overlay.innerHTML = `
    <div class="auth-card">
      <div class="auth-title">Productivity Dashboard</div>
      <div class="auth-subtitle">Войдите или зарегистрируйтесь</div>
      <div class="auth-tabs">
        <button class="auth-tab active" id="auth-tab-login" onclick="switchAuthTab('login')">Вход</button>
        <button class="auth-tab" id="auth-tab-register" onclick="switchAuthTab('register')">Регистрация</button>
      </div>
      <div class="auth-error" id="auth-error" style="display:none"></div>
      <form id="auth-form-login" onsubmit="handleLogin(event)">
        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="login-email" required placeholder="email@example.com" />
        </div>
        <div class="auth-field">
          <label>Пароль</label>
          <div class="password-wrap">
            <input type="password" id="login-password" required placeholder="Пароль" minlength="6" />
            <button type="button" class="password-toggle" onclick="togglePasswordVisibility('login-password', this)" title="Показать/скрыть пароль">
              <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="eye-off-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <button type="submit" class="auth-submit">Войти</button>
      </form>
      <form id="auth-form-register" style="display:none" onsubmit="handleRegister(event)">
        <div class="auth-field">
          <label>Имя пользователя</label>
          <input type="text" id="reg-username" required placeholder="username" minlength="3" maxlength="50" />
        </div>
        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="reg-email" required placeholder="email@example.com" />
        </div>
        <div class="auth-field">
          <label>Пароль</label>
          <div class="password-wrap">
            <input type="password" id="reg-password" required placeholder="Минимум 6 символов" minlength="6" />
            <button type="button" class="password-toggle" onclick="togglePasswordVisibility('reg-password', this)" title="Показать/скрыть пароль">
              <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="eye-off-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <button type="submit" class="auth-submit">Зарегистрироваться</button>
      </form>
    </div>`;
}

function switchAuthTab(tab) {
  document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-form-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('auth-form-register').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('auth-error').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('auth-error');
  try {
    await doLogin(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value,
    );
    hideAuthOverlay();
    renderUserBadge();
    initProjectsNav();
    await applyDefaultsIfNewUser();
    if (typeof applyWidgetVisibility === 'function') applyWidgetVisibility();
    if (typeof rerenderAllWidgets === 'function') rerenderAllWidgets();
    if (typeof initAllWidgets === 'function') initAllWidgets();
    var params = new URLSearchParams(window.location.search);
    var redirect = params.get('redirect');
    if (redirect) window.location.href = redirect;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = '';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('auth-error');
  try {
    await doRegister(
      document.getElementById('reg-username').value,
      document.getElementById('reg-email').value,
      document.getElementById('reg-password').value,
    );
    hideAuthOverlay();
    renderUserBadge();
    initProjectsNav();
    await applyDefaultsIfNewUser();
    if (typeof applyWidgetVisibility === 'function') applyWidgetVisibility();
    if (typeof rerenderAllWidgets === 'function') rerenderAllWidgets();
    if (typeof initAllWidgets === 'function') initAllWidgets();
    var params = new URLSearchParams(window.location.search);
    var redirect = params.get('redirect');
    if (redirect) window.location.href = redirect;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = '';
  }
}

function renderUserBadge() {
  const el = document.getElementById('user-badge');
  if (!el) return;
  const user = getCurrentUser();
  if (user) {
    const adminBtn = user.role === 'admin'
      ? '<button class="user-badge-admin" onclick="openDashboardAdmin()" title="Админ-панель Dashboard">&#x2699;</button>'
      : '';
    el.innerHTML = `
      <div class="user-badge-row">
        <button class="user-badge-name" onclick="openWidgetSettings()" title="Настройки виджетов">${user.username}</button>
        <span class="user-badge-role">${user.role}</span>
        ${adminBtn}
        <button class="user-badge-logout" onclick="doLogout()" title="Выйти">&#x23FB;</button>
      </div>
      <div id="user-ip"></div>`;
    el.style.display = 'flex';
    fetchUserIP();
  } else {
    el.style.display = 'none';
  }
}

function fetchUserIP() {
  fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById('user-ip');
      if (el) el.textContent = 'IP: ' + d.ip;
    })
    .catch(() => {});
}

async function applyDefaultsIfNewUser() {
  // Load global defaults and widget config in parallel
  const [defaults] = await Promise.all([
    typeof loadDefaults === 'function' ? loadDefaults() : null,
    typeof loadWidgetConfig === 'function' ? loadWidgetConfig() : null,
  ]);
  // Merge widget config (label, zone, storageKeys) into WidgetRegistry
  if (typeof applyWidgetConfig === 'function') applyWidgetConfig();
  // Import defaults only for new users
  if (typeof isNewUser === 'function' && isNewUser()) {
    if (defaults && typeof importDefaults === 'function') importDefaults(defaults);
    if (typeof importWidgetDefaults === 'function') importWidgetDefaults();
  }
}

// Init: check auth on page load
async function initAuth() {
  renderAuthForm();
  const ok = await checkAuth();
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (ok) {
    hideAuthOverlay();
    renderUserBadge();
    initProjectsNav();
    await applyDefaultsIfNewUser();
    if (typeof applyWidgetVisibility === 'function') applyWidgetVisibility();
    if (typeof rerenderAllWidgets === 'function') rerenderAllWidgets();
    if (typeof initAllWidgets === 'function') initAllWidgets();
    if (redirect) {
      window.location.href = redirect;
    }
  } else {
    showAuthOverlay();
  }
}
