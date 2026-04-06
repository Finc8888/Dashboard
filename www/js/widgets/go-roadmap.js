'use strict';

// ── Go Roadmap (Interactive) ─────────────────────────────────────────────
const GO_LESSONS_KEY = 'prod_go_lessons_v1';
const GO_TOUR_KEY = 'prod_go_tour_v1';
const GO_CODE_KEY = 'prod_go_code_v1';
const GO_START_KEY = 'prod_go_start_date';

let currentGoTab = 'lessons';
let expandedLesson = null;

function loadGoProgress(key) { return loadJSON(key, {}); }
function saveGoProgress(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

function getGoStartDate() {
  let d = localStorage.getItem(GO_START_KEY);
  if (!d) {
    d = localDateStr(new Date());
    localStorage.setItem(GO_START_KEY, d);
  }
  return d;
}

function daysSinceGoStart() {
  const start = new Date(getGoStartDate() + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - start) / 86400000);
}

function isLessonAvailable(lessonIndex) {
  return lessonIndex <= daysSinceGoStart();
}

function toggleGoLesson(lessonId) {
  const progress = loadGoProgress(GO_LESSONS_KEY);
  if (progress[lessonId]) {
    delete progress[lessonId];
  } else {
    progress[lessonId] = { done: true, doneAt: new Date().toISOString() };
  }
  saveGoProgress(GO_LESSONS_KEY, progress);
  }

function toggleGoItem(key, itemId) {
  const progress = loadGoProgress(key);
  if (progress[itemId]) {
    delete progress[itemId];
  } else {
    progress[itemId] = { done: true, doneAt: new Date().toISOString() };
  }
  saveGoProgress(key, progress);
  }

function expandGoLesson(id) {
  expandedLesson = expandedLesson === id ? null : id;
  }

function setGoTab(tab) {
  currentGoTab = tab;
  document.querySelectorAll('.go-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  }

function renderGoTab() {
  const container = document.getElementById('go-tab-content');
  if (!container) return;

  // Summary
  const lp = loadGoProgress(GO_LESSONS_KEY);
  const tp = loadGoProgress(GO_TOUR_KEY);
  const cp = loadGoProgress(GO_CODE_KEY);
  const totalDone = Object.keys(lp).length + Object.keys(tp).length + Object.keys(cp).length;
  const totalItems = (typeof GO_LESSONS !== 'undefined' ? GO_LESSONS.length : 0)
    + (typeof GO_TOUR_EXERCISES !== 'undefined' ? GO_TOUR_EXERCISES.length : 0)
    + (typeof GO_CODE_STUDY !== 'undefined' ? GO_CODE_STUDY.length : 0);
  const summaryEl = document.getElementById('go-progress-summary');
  if (summaryEl) summaryEl.textContent = `${totalDone} / ${totalItems} выполнено`;

  if (currentGoTab === 'lessons') renderGoLessons(container);
  else if (currentGoTab === 'tour') renderGoTour(container);
  else if (currentGoTab === 'code') renderGoCode(container);
  else if (currentGoTab === 'books') renderGoBooks(container);
}

function renderGoLessons(container) {
  if (typeof GO_LESSONS === 'undefined') { container.innerHTML = ''; return; }
  const progress = loadGoProgress(GO_LESSONS_KEY);
  const doneCnt = Object.keys(progress).length;

  let html = `<div class="go-section-progress">
    <span style="font-size:12px;color:var(--muted)">Syncthing уроки: ${doneCnt}/${GO_LESSONS.length}</span>
    <div class="go-section-progress-bar">
      <div class="go-section-progress-fill" style="width:${(doneCnt/GO_LESSONS.length*100).toFixed(0)}%;background:var(--green)"></div>
    </div>
  </div>`;

  GO_LESSONS.forEach((lesson, i) => {
    const isDone = !!progress[lesson.id];
    const available = isLessonAvailable(i);
    const isExpanded = expandedLesson === lesson.id;

    if (!available) {
      const unlockDate = new Date(getGoStartDate() + 'T00:00:00');
      unlockDate.setDate(unlockDate.getDate() + i);
      const dateStr = unlockDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      html += `<div class="go-lesson-item go-lesson-locked">
        <div class="go-lesson-header">
          <div class="go-lesson-check" style="opacity:.3">🔒</div>
          <span class="go-lesson-num">${lesson.id}.</span>
          <span class="go-lesson-title">${escHtml(lesson.title)}</span>
          <span class="go-lesson-meta">откроется ${dateStr}</span>
        </div>
      </div>`;
      return;
    }

    html += `<div class="go-lesson-item">
      <div class="go-lesson-header" onclick="expandGoLesson(${lesson.id})">
        <div class="go-lesson-check ${isDone ? 'done' : ''}" onclick="event.stopPropagation();toggleGoLesson(${lesson.id})">${isDone ? '✓' : ''}</div>
        <span class="go-lesson-num">${lesson.id}.</span>
        <span class="go-lesson-title ${isDone ? 'done' : ''}">${escHtml(lesson.title)}</span>
        <span class="go-lesson-meta"><span>${lesson.time}</span></span>
      </div>`;

    if (isExpanded) {
      html += `<div class="go-lesson-body">
        <div style="font-size:13px;color:var(--muted);margin-bottom:10px">${escHtml(lesson.goal)}</div>`;
      (lesson.steps || []).forEach((step, si) => {
        html += `<div class="go-step">
          <div class="go-step-title">Шаг ${si + 1}: ${escHtml(step.title)}</div>
          <div class="go-step-text">${escHtml(step.text)}</div>
          ${step.code ? `<div class="go-step-code">${escHtml(step.code)}</div>` : ''}
        </div>`;
      });
      if (lesson.takeaways && lesson.takeaways.length) {
        html += `<div class="go-takeaways"><strong>Что вы узнали:</strong><br>${lesson.takeaways.map(t => '• ' + escHtml(t)).join('<br>')}</div>`;
      }
      if (lesson.codeToStudy && lesson.codeToStudy.length) {
        html += `<div class="go-code-study-list"><strong>Код для изучения:</strong> ${lesson.codeToStudy.map(c => `<code>${escHtml(c)}</code>`).join(', ')}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  });
  container.innerHTML = html;
}

function renderGoTour(container) {
  if (typeof GO_TOUR_EXERCISES === 'undefined') { container.innerHTML = ''; return; }
  const progress = loadGoProgress(GO_TOUR_KEY);
  const doneCnt = Object.keys(progress).length;

  let html = `<div class="go-section-progress">
    <span style="font-size:12px;color:var(--muted)">Go Tour упражнения: ${doneCnt}/${GO_TOUR_EXERCISES.length}</span>
    <div class="go-section-progress-bar">
      <div class="go-section-progress-fill" style="width:${(doneCnt/GO_TOUR_EXERCISES.length*100).toFixed(0)}%;background:var(--blue)"></div>
    </div>
  </div>`;

  GO_TOUR_EXERCISES.forEach(ex => {
    const isDone = !!progress[ex.id];
    html += `<div class="go-tour-item" style="display:flex;align-items:center;gap:10px">
      <div class="go-lesson-check ${isDone ? 'done' : ''}" onclick="toggleGoItem('${GO_TOUR_KEY}','${ex.id}')">${isDone ? '✓' : ''}</div>
      <div style="flex:1">
        <span style="font-size:13px;font-weight:600">${escHtml(ex.title)}</span>
        <span style="font-size:12px;color:var(--muted);margin-left:6px">${escHtml(ex.desc)}</span>
      </div>
      <a class="go-tour-link" href="${ex.url}" target="_blank" rel="noopener">go.dev →</a>
    </div>`;
  });
  container.innerHTML = html;
}

function renderGoCode(container) {
  if (typeof GO_CODE_STUDY === 'undefined') { container.innerHTML = ''; return; }
  const progress = loadGoProgress(GO_CODE_KEY);
  const doneCnt = Object.keys(progress).length;

  let html = `<div class="go-section-progress">
    <span style="font-size:12px;color:var(--muted)">Изучение кода Syncthing: ${doneCnt}/${GO_CODE_STUDY.length}</span>
    <div class="go-section-progress-bar">
      <div class="go-section-progress-fill" style="width:${(doneCnt/GO_CODE_STUDY.length*100).toFixed(0)}%;background:var(--yellow)"></div>
    </div>
  </div>`;

  GO_CODE_STUDY.forEach(item => {
    const isDone = !!progress[item.id];
    html += `<div class="go-code-item" style="display:flex;align-items:center;gap:10px">
      <div class="go-lesson-check ${isDone ? 'done' : ''}" onclick="toggleGoItem('${GO_CODE_KEY}','${item.id}')">${isDone ? '✓' : ''}</div>
      <div style="flex:1">
        <code style="font-size:13px;color:var(--cyan)">${escHtml(item.title)}</code>
        <span style="font-size:12px;color:var(--muted);margin-left:6px">— ${escHtml(item.desc)}</span>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function renderGoBooks(container) {
  if (typeof GO_BOOKS === 'undefined') { container.innerHTML = ''; return; }
  let html = '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Рекомендуемые ресурсы по этапам изучения</div>';
  GO_BOOKS.forEach(book => {
    html += `<div class="go-book-item" style="display:flex;align-items:center;gap:10px">
      <span style="font-size:14px">📖</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${escHtml(book.title)}</div>
        <div class="go-book-author">${escHtml(book.author)}</div>
      </div>
      <span class="go-book-stage">${escHtml(book.stage)}</span>
    </div>`;
  });
  container.innerHTML = html;
}

// Mark lesson 1 as done (completed today)
function markLesson1Done() {
  const p = loadGoProgress(GO_LESSONS_KEY);
  if (!p[1]) {
    p[1] = { done: true, doneAt: new Date().toISOString() };
    saveGoProgress(GO_LESSONS_KEY, p);
  }
}

function initGoRoadmap() {
  markLesson1Done();
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'go-roadmap',
  render: renderGoTab,
  init: initGoRoadmap,
});
