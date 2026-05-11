'use strict';

// ── Data Export / Import ─────────────────────────────────────────────────
function exportData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const val = localStorage.getItem(key);
    try { data[key] = JSON.parse(val); } catch { data[key] = val; }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard-data-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== 'object' || data === null) throw new Error('bad format');
        const count = Object.keys(data).length;
        if (!confirm(`Импортировать ${count} записей? Существующие данные с совпадающими ключами будут перезаписаны.`)) return;
        Object.entries(data).forEach(([k, v]) => {
          // backward compat: old exports have string values, new — nested objects
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        });
        location.reload();
      } catch {
        alert('Ошибка: файл не является корректным JSON-экспортом.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
