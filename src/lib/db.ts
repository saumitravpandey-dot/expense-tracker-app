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
    CREATE TABLE IF NOT EXISTS transaction_rules (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern    TEXT    NOT NULL,
      match_type TEXT    NOT NULL DEFAULT 'contains',
      apply_to   TEXT    NOT NULL DEFAULT 'description',
      tx_type    TEXT    NOT NULL,
      category   TEXT    NOT NULL DEFAULT '',
      action     TEXT    NOT NULL DEFAULT 'include',
      enabled    INTEGER NOT NULL DEFAULT 1,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add transaction_type column to expenses if missing (migration)
  try { _db.exec(`ALTER TABLE expenses ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'expense'`); } catch { /* already exists */ }

  // Seed default mapping rules once
  const ruleCount = (_db.prepare('SELECT COUNT(*) as c FROM transaction_rules').get() as { c: number }).c;
  if (ruleCount === 0) {
    const seed = [
      // CC payments — exclude to avoid double counting
      ['CREDIT CARD', 'contains', 'description', 'cc_payment', '', 'exclude'],
      ['CC BILL', 'contains', 'description', 'cc_payment', '', 'exclude'],
      ['CREDITCARD', 'contains', 'description', 'cc_payment', '', 'exclude'],
      ['CCPAYMENT', 'contains', 'description', 'cc_payment', '', 'exclude'],
      // Investments — exclude
      ['/SIP/', 'contains', 'description', 'investment', '', 'exclude'],
      ['MUTUAL FUND', 'contains', 'description', 'investment', '', 'exclude'],
      ['MF-', 'contains', 'description', 'investment', '', 'exclude'],
      ['ZERODHA', 'contains', 'merchant', 'investment', '', 'exclude'],
      ['GROWW', 'contains', 'merchant', 'investment', '', 'exclude'],
      // Own transfers — exclude
      ['SELF TRANSFER', 'contains', 'description', 'transfer', '', 'exclude'],
      ['TO SAVINGS', 'contains', 'description', 'transfer', '', 'exclude'],
      ['SWEEP IN', 'contains', 'description', 'transfer', '', 'exclude'],
      // Loans — include as Bills
      ['HOME LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include'],
      ['EMI', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include'],
      // Insurance — include as Bills
      ['LIC PREMIUM', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include'],
      ['INSURANCE', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include'],
      // Bank fees — include as Bills
      ['SERVICE CHARGE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include'],
      ['ANNUAL FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include'],
      // ATM cash
      ['ATM', 'contains', 'description', 'cash', '', 'include'],
    ];
    const ins = _db.prepare(
      'INSERT INTO transaction_rules (pattern, match_type, apply_to, tx_type, category, action) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const r of seed) ins.run(...r);
  }
  return _db;
}
