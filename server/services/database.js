import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'aliina.db');

export const db = new Database(dbPath);

// WAL mode для лучшей производительности
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    messages TEXT DEFAULT '[]',
    client_data TEXT DEFAULT '{}',
    dialogue_state TEXT DEFAULT 'greeting',
    created_at TEXT,
    updated_at TEXT
  )
`);

// Миграция: добавить колонку dialogue_state если её нет
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN dialogue_state TEXT DEFAULT 'greeting'`);
} catch {
  // Колонка уже существует — OK
}
