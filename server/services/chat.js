import { buildSystemPrompt } from './system-prompt.js';
import { db } from './database.js';
import {
  STATES,
  resolveState,
  extractClientData,
  cleanMessage,
  mergeClientData,
  checkSpecialState,
  buildStateContext
} from './dialogue-state.js';
import { notifyManager } from './telegram.js';

// In-memory cache сессий (lazy load из SQLite)
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    // Попробовать загрузить из БД
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (row) {
      sessions.set(sessionId, {
        id: row.id,
        messages: JSON.parse(row.messages),
        clientData: JSON.parse(row.client_data),
        dialogueState: row.dialogue_state || STATES.GREETING,
        createdAt: row.created_at
      });
    } else {
      const session = {
        id: sessionId,
        messages: [],
        clientData: {
          Client_name: '',
          Mebel_name: '',
          Dlina: '',
          Gorod: '',
          Ylitsa: '',
          Telefon: '',
          Vremya_client: '',
          Client_Project: '',
          Orientir_price: ''
        },
        dialogueState: STATES.GREETING,
        createdAt: new Date().toISOString()
      };
      sessions.set(sessionId, session);
      db.prepare(
        'INSERT INTO sessions (id, messages, client_data, dialogue_state, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(session.id, '[]', JSON.stringify(session.clientData), session.dialogueState, session.createdAt);
    }
  }
  return sessions.get(sessionId);
}

function saveSession(session) {
  db.prepare(
    'UPDATE sessions SET messages = ?, client_data = ?, dialogue_state = ?, updated_at = ? WHERE id = ?'
  ).run(
    JSON.stringify(session.messages),
    JSON.stringify(session.clientData),
    session.dialogueState,
    new Date().toISOString(),
    session.id
  );
}

/**
 * Обрабатывает ответ AI: извлекает данные, обновляет состояние
 */
function processAssistantResponse(session, rawMessage) {
  const prevState = session.dialogueState;

  // Извлечь данные клиента из ответа
  const extracted = extractClientData(rawMessage);
  if (extracted) {
    session.clientData = mergeClientData(session.clientData, extracted);
  }

  // Проверить спецсостояния
  const specialState = checkSpecialState(rawMessage, session.dialogueState);
  if (specialState) {
    session.dialogueState = specialState;
  }

  // Обновить состояние на основе собранных данных
  session.dialogueState = resolveState(session.dialogueState, session.clientData);

  // Автоматическое уведомление менеджера при завершении диалога
  if (session.dialogueState === STATES.COMPLETED && prevState !== STATES.COMPLETED) {
    notifyManager(session.clientData, session.id).catch(err =>
      console.error('Auto-notify error:', err.message)
    );
  }

  // Очистить сообщение от служебных тегов
  return cleanMessage(rawMessage);
}

export function getAllSessions() {
  const rows = db.prepare(
    'SELECT id, client_data, messages, dialogue_state, created_at FROM sessions ORDER BY updated_at DESC'
  ).all();
  return rows.map(r => ({
    id: r.id,
    clientData: JSON.parse(r.client_data),
    dialogueState: r.dialogue_state || STATES.GREETING,
    messageCount: JSON.parse(r.messages).length,
    createdAt: r.created_at
  }));
}

export function getSessionMessages(sessionId) {
  const row = db.prepare('SELECT messages FROM sessions WHERE id = ?').get(sessionId);
  return row ? JSON.parse(row.messages) : [];
}

export function getSessionState(sessionId) {
  const session = getSession(sessionId);
  return {
    dialogueState: session.dialogueState,
    clientData: session.clientData
  };
}

function buildFullSystemPrompt(session) {
  const basePrompt = buildSystemPrompt();
  const stateContext = buildStateContext(session.dialogueState, session.clientData);
  return basePrompt + '\n\n' + stateContext;
}

// Обычный (не-streaming) чат
export async function chat(sessionId, userMessage) {
  const session = getSession(sessionId);
  const systemPrompt = buildFullSystemPrompt(session);

  session.messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...session.messages
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenRouter API error');
  }

  const rawMessage = data.choices[0].message.content;
  const cleanedMessage = processAssistantResponse(session, rawMessage);

  session.messages.push({ role: 'assistant', content: cleanedMessage });
  saveSession(session);

  return { reply: cleanedMessage, state: session.dialogueState, clientData: session.clientData };
}

// Streaming чат (SSE)
export async function chatStream(sessionId, userMessage, res) {
  const session = getSession(sessionId);
  const systemPrompt = buildFullSystemPrompt(session);

  session.messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...session.messages
      ]
    })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'OpenRouter API error');
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  let fullMessage = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Буфер для фильтрации служебных тегов из стрима
  let pendingOutput = '';
  let insideTag = false;
  let tagBuffer = '';

  function flushVisible(text) {
    // Фильтруем <!--DATA:...--> и <!--STATE:...--> из потока в реальном времени
    for (const char of text) {
      if (insideTag) {
        tagBuffer += char;
        if (tagBuffer.endsWith('-->')) {
          // Тег закрылся — не отправляем его клиенту
          insideTag = false;
          tagBuffer = '';
        }
      } else if (pendingOutput.endsWith('<!-') && char === '-') {
        pendingOutput = pendingOutput.slice(0, -3);
        insideTag = true;
        tagBuffer = '<!--';
      } else if (pendingOutput.endsWith('<!') && char === '-') {
        pendingOutput += char;
      } else if (pendingOutput.endsWith('<') && char === '!') {
        pendingOutput += char;
      } else if (char === '<') {
        pendingOutput += char;
      } else {
        // Если накопились символы '<', '<!', '<!' которые не стали тегом — сбрасываем
        if (pendingOutput.length > 0) {
          const toSend = pendingOutput;
          pendingOutput = '';
          res.write(`data: ${JSON.stringify({ text: toSend })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ text: char })}\n\n`);
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // оставляем незавершённую строку

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullMessage += delta;
            flushVisible(delta);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('Stream error:', err);
  }

  // Обработка полного ответа — извлечение данных, обновление состояния
  const cleanedMessage = processAssistantResponse(session, fullMessage);

  session.messages.push({ role: 'assistant', content: cleanedMessage });
  saveSession(session);

  // Отправить финальное событие с состоянием
  res.write(`data: ${JSON.stringify({ state: session.dialogueState, clientData: session.clientData })}\n\n`);
  res.write(`data: [DONE]\n\n`);
  res.end();
}
