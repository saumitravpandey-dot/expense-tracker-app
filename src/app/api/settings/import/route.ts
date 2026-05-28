import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { TRANSACTION_TYPES } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    let imported = 0;
    let skipped = 0;

    // Import expenses
    if (Array.isArray(body.expenses)) {
      const ins = db.prepare(`
        INSERT INTO expenses (amount, currency, merchant, category, date, description, source, transaction_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of body.expenses) {
        if (!e.amount || !e.date) { skipped++; continue; }
        const txType = (TRANSACTION_TYPES as readonly string[]).includes(e.transaction_type) ? e.transaction_type : 'expense';
        try {
          ins.run(
            Number(e.amount),
            e.currency ?? 'INR',
            e.merchant ?? '',
            e.category ?? 'Other',
            e.date,
            e.description ?? '',
            'import',
            txType,
          );
          imported++;
        } catch { skipped++; }
      }
    }

    // Upsert budgets
    let budgetsImported = 0;
    if (Array.isArray(body.budgets)) {
      const ups = db.prepare(
        'INSERT INTO budgets (category, amount, currency) VALUES (?, ?, ?) ON CONFLICT(category) DO UPDATE SET amount=excluded.amount, currency=excluded.currency'
      );
      for (const b of body.budgets) {
        if (!b.category || !b.amount) continue;
        ups.run(b.category, Number(b.amount), b.currency ?? 'INR');
        budgetsImported++;
      }
    }

    // Import rules (skip if same pattern+match_type+apply_to already exists)
    let rulesImported = 0;
    if (Array.isArray(body.rules)) {
      const exists = db.prepare(
        'SELECT COUNT(*) as c FROM transaction_rules WHERE pattern = ? AND match_type = ? AND apply_to = ?'
      );
      const ins = db.prepare(
        'INSERT INTO transaction_rules (pattern, match_type, apply_to, tx_type, category, action) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const r of body.rules) {
        if (!r.pattern) continue;
        const { c } = exists.get(r.pattern, r.match_type ?? 'contains', r.apply_to ?? 'description') as { c: number };
        if (c === 0) {
          ins.run(r.pattern, r.match_type ?? 'contains', r.apply_to ?? 'description', r.tx_type ?? 'expense', r.category ?? '', r.action ?? 'include');
          rulesImported++;
        }
      }
    }

    return NextResponse.json({ imported, skipped, budgetsImported, rulesImported });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
  }
}
