import { Router } from 'express';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { chat, chatStream, getAllSessions, getSessionMessages, getSessionState } from '../services/chat.js';
import { notifyManager } from '../services/telegram.js';
import { transcribeAudio } from '../services/stt.js';
import { synthesizeSpeech } from '../services/tts.js';
import { calculateByCategory, calculateByModel, extractModelFromUrl, parseLengthToMeters } from '../services/calculator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const uploadsDir = join(__dirname, '..', 'uploads');
mkdirSync(uploadsDir, { recursive: true });

// Multer для аудио (в память — отправляем напрямую в API)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — лимит Whisper
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Только аудио файлы'));
    }
  }
});

// Multer для файлов/фото клиента (на диск)
const fileUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const ext = file.originalname.split('.').pop();
      cb(null, `${unique}.${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимые форматы: JPG, PNG, WEBP, GIF, PDF'));
    }
  }
});

const router = Router();

// Chat endpoint (non-streaming fallback)
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message required' });
    }
    const result = await chat(sessionId, message);
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Chat endpoint (streaming SSE)
router.post('/chat/stream', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message required' });
    }
    await chatStream(sessionId, message, res);
  } catch (err) {
    console.error('Chat stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Speech-to-Text (Whisper API)
router.post('/stt', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудио файл не получен' });
    }
    const text = await transcribeAudio(req.file.buffer, req.file.mimetype);
    res.json({ text });
  } catch (err) {
    console.error('STT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Text-to-Speech (OpenAI TTS API)
router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }
    const ttsResponse = await synthesizeSpeech(text);

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked'
    });

    // Стримим аудио напрямую клиенту
    const reader = ttsResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error('TTS error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Upload файлов/фото клиента
router.post('/upload', fileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не получен' });
    }
    res.json({
      ok: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Расчёт стоимости
router.post('/calculate', (req, res) => {
  try {
    const { category, modelId, length, url, shape, width, depth, width2 } = req.body;

    // Парсим длину
    const lengthM = parseLengthToMeters(length);
    if (!lengthM && !url) {
      return res.status(400).json({ error: 'Укажите длину (length)' });
    }

    // Расчёт по URL (извлекаем номер модели)
    if (url) {
      const id = extractModelFromUrl(url);
      if (!id) return res.status(400).json({ error: 'Не удалось извлечь номер модели из URL' });
      const result = calculateByModel(id, lengthM || 1);
      return res.json(result);
    }

    // Расчёт по номеру модели
    if (modelId) {
      const result = calculateByModel(modelId, lengthM);
      return res.json(result);
    }

    // Расчёт по категории
    if (category) {
      const result = calculateByCategory(category, lengthM, { shape, width, depth, width2 });
      return res.json(result);
    }

    res.status(400).json({ error: 'Укажите category, modelId или url' });
  } catch (err) {
    console.error('Calculate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Notify manager via Telegram
router.post('/notify', async (req, res) => {
  try {
    const { sessionId, clientData } = req.body;
    await notifyManager(clientData, sessionId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Notification error' });
  }
});

// Session state (dialogue state + client data)
router.get('/session-state/:id', (req, res) => {
  const state = getSessionState(req.params.id);
  res.json(state);
});

// Admin: list all sessions
router.get('/sessions', (req, res) => {
  res.json(getAllSessions());
});

// Admin: get session messages
router.get('/sessions/:id', (req, res) => {
  const messages = getSessionMessages(req.params.id);
  res.json({ messages });
});

// --- Database files API ---

const DB_FILES = {
  'company-info': { file: 'company-info.json', type: 'json', label: 'Информация о компании' },
  'models': { file: 'models.json', type: 'json', label: 'Модели и цены' },
  'price-category': { file: 'price-category.json', type: 'json', label: 'Цены по категориям' },
  'exceptions': { file: 'exceptions.json', type: 'json', label: 'Исключения' },
  'prompt-system': { file: 'prompts/system.md', type: 'text', label: 'Системный промт' },
  'prompt-algorithms': { file: 'prompts/algorithms.md', type: 'text', label: 'Алгоритмы расчёта' }
};

// List all databases
router.get('/databases', (req, res) => {
  const list = Object.entries(DB_FILES).map(([key, info]) => ({
    key,
    label: info.label,
    type: info.type
  }));
  res.json(list);
});

// Get database content
router.get('/databases/:key', (req, res) => {
  const info = DB_FILES[req.params.key];
  if (!info) return res.status(404).json({ error: 'Database not found' });

  try {
    const content = readFileSync(join(dataDir, info.file), 'utf-8');
    res.json({ key: req.params.key, label: info.label, type: info.type, content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Save database content
router.put('/databases/:key', (req, res) => {
  const info = DB_FILES[req.params.key];
  if (!info) return res.status(404).json({ error: 'Database not found' });

  try {
    const { content } = req.body;
    // Validate JSON before saving
    if (info.type === 'json') {
      JSON.parse(content);
    }
    writeFileSync(join(dataDir, info.file), content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Invalid content: ' + err.message });
  }
});

export default router;
