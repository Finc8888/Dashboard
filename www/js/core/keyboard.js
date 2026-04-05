'use strict';

// ── Keyboard Shortcuts ───────────────────────────────────────────────────
function toggleShortcutsHelp() {
  const el = document.getElementById('shortcuts-overlay');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
    if (e.key === 'Escape') { e.target.blur(); e.preventDefault(); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'n':
      e.preventDefault();
      if (zenMode) toggleZenMode();
      document.getElementById(dayOff ? 'wp-input' : 'todo-input').focus();
      break;
    case 'f':
      e.preventDefault();
      toggleZenMode();
      break;
    case 'o':
      e.preventDefault();
      toggleDayOff();
      break;
    case ' ': {
      e.preventDefault();
      const current = loadTasks().find(t => t.current);
      if (current) toggleTask(current.id);
      break;
    }
    case 'd':
      e.preventDefault();
      toggleDistractionPanel();
      break;
    case 'a':
      e.preventDefault();
      navigateToAdmin();
      break;
    case 'w':
      e.preventDefault();
      openWidgetSettings();
      break;
    case 't':
      e.preventDefault();
      toggleTodoFullscreen();
      break;
    case 'm':
      e.preventDefault();
      toggleStickerFullscreen();
      break;
    case 'escape':
      e.preventDefault();
      if (document.querySelector('.todo-card.todo-fullscreen')) {
        toggleTodoFullscreen();
      } else if (document.querySelector('.sticker-card.sticker-fullscreen')) {
        toggleStickerFullscreen();
      } else if (document.querySelector('.wp-card.wp-fullscreen')) {
        toggleWpFullscreen();
      } else {
        closeWidgetSettings();
        closeDashboardAdmin();
        closeRecordsModal();
        if (document.getElementById('shortcuts-overlay').style.display !== 'none')
          toggleShortcutsHelp();
      }
      break;
    case 'home':
      e.preventDefault();
      scrollToEdge('top');
      break;
    case 'end':
      e.preventDefault();
      scrollToEdge('bottom');
      break;
    case '?':
      e.preventDefault();
      toggleShortcutsHelp();
      break;
    default:
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const cfg = getWidgetConfig();
        const order = cfg ? cfg.order : [...DEFAULT_WIDGET_ORDER];
        const visibleOrder = order.filter(id => {
          if (!cfg) return id === 'todo';
          return cfg.visible[id] !== false;
        });
        const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;
        if (visibleOrder[idx]) {
          const el = document.querySelector(`[data-widget="${visibleOrder[idx]}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const input = el.querySelector('textarea, input[type="text"], input:not([type])');
            if (input) setTimeout(() => input.focus(), 300);
          }
        }
      }
  }
});

function navigateToAdmin() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && user.role === 'admin') window.location.href = '/admin/';
}

function scrollToEdge(dir) {
  window.scrollTo({ top: dir === 'top' ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
}
