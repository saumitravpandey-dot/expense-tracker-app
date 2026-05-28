import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'expenses.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL,
      currency    TEXT    NOT NULL DEFAULT 'INR',
      merchant    TEXT    NOT NULL DEFAULT '',
      category    TEXT    NOT NULL DEFAULT 'Other',
      date        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      source      TEXT    NOT NULL DEFAULT 'manual',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT    UNIQUE NOT NULL,
      amount   REAL    NOT NULL,
      currency TEXT    NOT NULL DEFAULT 'INR'
    );
  `);
  return _db;
}
