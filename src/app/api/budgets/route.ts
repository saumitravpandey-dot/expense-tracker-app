import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export interface Budget {
  id: number;
  category: string;
  amount: number;
  currency: string;
}

export async function GET() {
  const db = getDb();
  const budgets = db.prepare('SELECT * FROM budgets ORDER BY category').all() as Budget[];
  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { category, amount, currency = 'INR' } = await req.json();

  if (!category || !amount) {
    return NextResponse.json({ error: 'category and amount required' }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO budgets (category, amount, currency)
    VALUES (?, ?, ?)
    ON CONFLICT(category) DO UPDATE SET amount = excluded.amount, currency = excluded.currency
  `).run(category, amount, currency);

  const saved = db.prepare('SELECT * FROM budgets WHERE category = ?').get(category) as Budget;
  return NextResponse.json(saved);
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const { category } = await req.json();
  db.prepare('DELETE FROM budgets WHERE category = ?').run(category);
  return new NextResponse(null, { status: 204 });
}
