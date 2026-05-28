import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Expense } from '@/lib/types';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const category = searchParams.get('category');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params: (string | number)[] = [];

  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (from) {
    query += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND date <= ?';
    params.push(to);
  }

  query += ' ORDER BY date DESC, id DESC';

  const expenses = db.prepare(query).all(...params) as Expense[];
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { amount, currency = 'INR', merchant = '', category = 'Other', date, description = '', source = 'manual' } = body;

  if (!amount || !date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 });
  }

  const result = db.prepare(`
    INSERT INTO expenses (amount, currency, merchant, category, date, description, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(amount, currency, merchant, category, date, description, source);

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid) as Expense;
  return NextResponse.json(created, { status: 201 });
}
