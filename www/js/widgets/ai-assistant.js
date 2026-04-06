'use strict';

// ── AI Assistant (Ollama / Gemma) ──────────────────────────────────────────
const AI_HISTORY_KEY = 'prod_ai_history_v1';
const AI_OLLAMA_URL = localStorage.getItem('prod_ai_ollama_url') || 'http://localhost:11434';
const AI_MODEL = localStorage.getItem('prod_ai_model') || 'qwen3.5:4b';
const AI_CONTEXT_KEY = 'prod_ai_context_v1';

function aiLoadHistory() {
  try { return JSON.parse(localStorage.getItem(AI_HISTORY_KEY)) || []; } catch { return []; }
}
function aiSaveHistory(msgs) {
  localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(msgs));
}

function aiCollectContext() {
  const today = todayStr();
  const summary = { date: today, sections: {} };

  // Helper: safe parse
  const parse = (key) => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };

  // Collect all prod_* keys (skip AI own keys)
  const allData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith('prod_') || key.startsWith('prod_ai_')) continue;
    allData[key] = parse(key) || localStorage.getItem(key);
  }

  // ── TODO tasks ──
  const todoKeys = Object.keys(allData).filter(k => k.startsWith('prod_todo'));
  for (const key of todoKeys) {
    const d = allData[key];
    if (d && d.items) {
      const items = d.items;
      const done = items.filter(t => t.done).length;
      const pending = items.filter(t => !t.done);
      summary.sections.todo = {
        total: items.length,
        done,
        pending: pending.length,
        pendingTasks: pending.map(t => t.text),
        date: d.date || key,
      };
    }
  }

  // ── Schedule ──
  const schedKeys = Object.keys(allData).filter(k => k.startsWith('prod_schedule'));
  for (const key of schedKeys) {
    const d = allData[key];
    if (d && d.slots) {
      const slots = d.slots;
      const done = slots.filter(s => s.done).length;
      summary.sections.schedule = {
        totalSlots: slots.length,
        completedSlots: done,
        slots: slots.map(s => ({ time: s.time, label: s.label, done: s.done })),
      };
    }
  }

  // ── Monthly goals ──
  const monthlyKeys = Object.keys(allData).filter(k => k.startsWith('prod_goals_monthly'));
  for (const key of monthlyKeys) {
    const d = allData[key];
    if (d && Array.isArray(d.goals)) {
      summary.sections.monthlyGoals = {
        period: d.period || key,
        goals: d.goals.map(g => ({ text: g.text, done: g.done, recurring: g.recurring || false })),
      };
    }
  }

  // ── Yearly goals ──
  const yearlyKeys = Object.keys(allData).filter(k => k.startsWith('prod_goals_yearly'));
  for (const key of yearlyKeys) {
    const d = allData[key];
    if (d && Array.isArray(d.goals)) {
      summary.sections.yearlyGoals = {
        period: d.period || key,
        goals: d.goals.map(g => ({ text: g.text, done: g.done })),
      };
    }
  }

  // ── Stats (early start, distractions, duolingo) ──
  const statsKeys = Object.keys(allData).filter(k => k.match(/prod_(early|distract|duolingo|stats)/));
  for (const key of statsKeys) {
    if (!summary.sections.stats) summary.sections.stats = {};
    summary.sections.stats[key] = allData[key];
  }

  // ── Reading ──
  const readKeys = Object.keys(allData).filter(k => k.startsWith('prod_reading'));
  for (const key of readKeys) {
    summary.sections.reading = allData[key];
  }

  // ── Scratchpad ──
  const sp = allData['prod_scratchpad_v1'];
  if (sp && sp.text) {
    summary.sections.scratchpad = { date: sp.date, text: sp.text };
  }

  // ── Stickers / reminders ──
  const stickerKeys = Object.keys(allData).filter(k => k.startsWith('prod_sticker'));
  for (const key of stickerKeys) {
    summary.sections.stickers = allData[key];
  }

  // ── Running ──
  const runKeys = Object.keys(allData).filter(k => k.startsWith('prod_running'));
  for (const key of runKeys) {
    summary.sections.running = allData[key];
  }

  // ── Cushion / mortgage ──
  const finKeys = Object.keys(allData).filter(k => k.match(/prod_(cushion|mortgage)/));
  for (const key of finKeys) {
    if (!summary.sections.finance) summary.sections.finance = {};
    summary.sections.finance[key] = allData[key];
  }

  const ctx = JSON.stringify(summary, null, 2);
  localStorage.setItem(AI_CONTEXT_KEY, ctx);
  return ctx;
}

function aiBuildSystemPrompt(context) {
  return `Ты — AI-ассистент Gladys Dashboard. У тебя есть ПОЛНЫЙ доступ к данным пользователя.
ВАЖНО: Ниже приведены РЕАЛЬНЫЕ данные пользователя. Используй их для ответов. НЕ говори что у тебя нет данных.
Отвечай на русском. Кратко и конкретно. Используй markdown.

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
${context}

Структура данных:
- todo: задачи на день (pendingTasks — невыполненные, done — выполненные)
- schedule: расписание дня (slots с временем и статусом)
- monthlyGoals: цели на месяц (text, done, recurring)
- yearlyGoals: цели на год
- stats: ранний старт, отвлечения, duolingo
- reading: прогресс чтения книг
- scratchpad: заметки
- stickers: напоминания
- running: тренировки бега
- finance: подушка, ипотека

Всегда основывай ответы на этих данных.`;
}

function aiRenderMessages() {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  const history = aiLoadHistory();
  container.innerHTML = '';
  for (const msg of history) {
    if (msg.role === 'system') continue;
    const div = document.createElement('div');
    div.className = 'ai-msg ' + (msg.role === 'user' ? 'user' : 'assistant');
    if (msg.role === 'assistant') {
      div.innerHTML = aiFormatMarkdown(msg.content);
    } else {
      div.textContent = msg.content;
    }
    container.appendChild(div);
  }
  container.scrollTop = container.scrollHeight;
}

function aiFormatMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/(<\/ul>\s*<ul>)/g, '')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^/, '<p>').replace(/$/, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1');
}

function aiShowTyping() {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  const typing = document.createElement('div');
  typing.className = 'ai-typing';
  typing.id = 'ai-typing';
  typing.innerHTML = '<span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}

function aiHideTyping() {
  const el = document.getElementById('ai-typing');
  if (el) el.remove();
}

async function aiSend() {
  const input = document.getElementById('ai-input');
  const text = (input.value || '').trim();
  if (!text) return;

  const history = aiLoadHistory();
  history.push({ role: 'user', content: text });
  aiSaveHistory(history);
  input.value = '';
  input.style.height = 'auto';
  aiRenderMessages();
  aiShowTyping();

  const sendBtn = document.getElementById('ai-send-btn');
  const voiceBtn = document.getElementById('ai-voice-btn');
  sendBtn.disabled = true;
  if (voiceBtn) voiceBtn.disabled = true;

  try {
    const context = aiCollectContext();
    const systemPrompt = aiBuildSystemPrompt(context);
    // Build messages for API: system + last 10 messages for context window
    const recentHistory = history.filter(m => m.role !== 'system').slice(-10);
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory
    ];

    const resp = await fetch(AI_OLLAMA_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: apiMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 16384,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Ollama ответил ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const reply = data.message?.content || 'Пустой ответ от модели.';

    history.push({ role: 'assistant', content: reply });
    aiSaveHistory(history);
  } catch (err) {
    history.push({ role: 'assistant', content: '⚠ Ошибка: ' + err.message });
    aiSaveHistory(history);
  } finally {
    aiHideTyping();
    aiRenderMessages();
    sendBtn.disabled = false;
    if (voiceBtn) voiceBtn.disabled = false;
  }
}

function aiClearHistory() {
  if (!confirm('Очистить историю чата с AI?')) return;
  localStorage.removeItem(AI_HISTORY_KEY);
  localStorage.removeItem(AI_CONTEXT_KEY);
  aiRenderMessages();
}

// ── Voice Input (Web Speech API) ──────────────────────────────────────────
let aiRecognition = null;
let aiIsRecording = false;

function aiToggleVoice() {
  if (aiIsRecording) {
    aiStopVoice();
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Браузер не поддерживает голосовой ввод. Используй Chrome.');
    return;
  }

  aiRecognition = new SpeechRecognition();
  aiRecognition.lang = 'ru-RU';
  aiRecognition.interimResults = true;
  aiRecognition.continuous = false;

  const input = document.getElementById('ai-input');
  const btn = document.getElementById('ai-voice-btn');
  const originalText = input.value;

  aiRecognition.onstart = () => {
    aiIsRecording = true;
    btn.classList.add('recording');
    btn.textContent = '⏹';
  };

  aiRecognition.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        final += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    input.value = originalText + (originalText ? ' ' : '') + (final || interim);
  };

  aiRecognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    aiStopVoice();
  };

  aiRecognition.onend = () => {
    aiStopVoice();
  };

  aiRecognition.start();
}

function aiStopVoice() {
  aiIsRecording = false;
  const btn = document.getElementById('ai-voice-btn');
  if (btn) {
    btn.classList.remove('recording');
    btn.textContent = '🎤';
  }
  if (aiRecognition) {
    try { aiRecognition.stop(); } catch {}
    aiRecognition = null;
  }
}

async function aiCheckConnection() {
  const status = document.getElementById('ai-status');
  if (!status) return;
  try {
    const resp = await fetch(AI_OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      const hasModel = data.models?.some(m => m.name.startsWith(AI_MODEL.split(':')[0]));
      status.textContent = hasModel ? `Модель ${AI_MODEL} подключена` : 'Модель не найдена';
      status.className = 'ai-status ' + (hasModel ? 'connected' : 'error');
    } else {
      status.textContent = 'Ollama недоступна';
      status.className = 'ai-status error';
    }
  } catch {
    status.textContent = 'Ollama недоступна';
    status.className = 'ai-status error';
  }
}

function initAiAssistant() {
  aiRenderMessages();
  aiCheckConnection();

  // Enter to send, Shift+Enter for newline
  const input = document.getElementById('ai-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        aiSend();
      }
    });
    // Auto-resize
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }
}

function renderAiAssistant() {
  aiRenderMessages();
}

// ── Registration ────────────────────────────────────────────────────────
registerWidget({
  id: 'ai-assistant',
  render: renderAiAssistant,
  init: initAiAssistant,
});
