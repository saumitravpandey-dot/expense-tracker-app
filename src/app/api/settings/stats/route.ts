import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const row = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as totalAmount,
      MIN(date) as firstDate,
      MAX(date) as lastDate
    FROM expenses
    WHERE transaction_type != 'income'
  `).get() as { count: number; totalAmount: number; firstDate: string | null; lastDate: string | null };

  const currency = (db.prepare(`SELECT currency FROM expenses ORDER BY id DESC LIMIT 1`).get() as { currency: string } | undefined)?.currency ?? 'INR';
  const budgetCount = (db.prepare(`SELECT COUNT(*) as c FROM budgets`).get() as { c: number }).c;
  const ruleCount = (db.prepare(`SELECT COUNT(*) as c FROM transaction_rules`).get() as { c: number }).c;

  return NextResponse.json({
    count: row.count,
    totalAmount: row.totalAmount,
    currency,
    firstDate: row.firstDate,
    lastDate: row.lastDate,
    budgetCount,
    ruleCount,
  });
}
