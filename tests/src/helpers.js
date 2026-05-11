const fs = require('fs');
const path = require('path');

// In Docker: /app/src/ → /app/www/js (one level up)
// Locally:  tests/src/ → www/js (two levels up)
const WWW = process.env.WWW_JS_PATH
  || (fs.existsSync(path.resolve(__dirname, '..', 'www', 'js'))
    ? path.resolve(__dirname, '..', 'www', 'js')
    : path.resolve(__dirname, '..', '..', 'www', 'js'));

/**
 * Load a Dashboard JS file into the global scope (simulates <script> tag).
 * Uses indirect eval so function declarations become global in jsdom context.
 * @param {string} relPath - path relative to www/js/, e.g. 'core/utils.js'
 */
function loadScript(relPath) {
  const filePath = path.join(WWW, relPath);
  const code = fs.readFileSync(filePath, 'utf8');
  // Remove 'use strict' to avoid restrictions in global eval
  let cleaned = code.replace(/^'use strict';\s*/m, '');
  // Convert top-level const/let to var so they become global bindings in eval.
  // ^(const|let) with multiline flag matches only unindented declarations (top-level).
  cleaned = cleaned.replace(/^(const|let) /gm, 'var ');
  // Indirect eval executes in global scope (where window, document, localStorage exist)
  (0, eval)(cleaned);
}

/**
 * Load core scripts in correct order (utils -> widget-manager).
 */
function loadCore() {
  loadScript('core/utils.js');
  loadScript('core/widget-manager.js');
}

/**
 * Load a widget file (requires core to be loaded first).
 * @param {string} name - widget file name, e.g. 'todo.js'
 */
function loadWidget(name) {
  loadScript(`widgets/${name}`);
}

/**
 * Load widgets-config.json and apply it to WidgetRegistry (sync, for tests).
 * Must be called after loadCore() and all loadWidget() calls.
 */
function applyWidgetConfigSync() {
  const configPath = path.join(WWW, 'widgets', 'widgets-config.json');
  const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  _widgetConfigCache = data;
  applyWidgetConfig();
}

module.exports = { loadScript, loadCore, loadWidget, applyWidgetConfigSync, WWW };
