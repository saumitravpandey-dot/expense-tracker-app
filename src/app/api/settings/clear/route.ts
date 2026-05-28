import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST() {
  const db = getDb();
  db.prepare('DELETE FROM expenses').run();
  db.prepare('DELETE FROM budgets').run();
  db.prepare('DELETE FROM transaction_rules').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('expenses','budgets','transaction_rules')").run();
  return NextResponse.json({ ok: true });
}
