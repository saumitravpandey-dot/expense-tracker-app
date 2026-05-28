import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { TRANSACTION_TYPES } from '@/lib/types';
import type { Expense } from '@/lib/types';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);

  // Merchants autocomplete
  if (searchParams.get('merchants') === '1') {
    const rows = db.prepare(
      `SELECT merchant, COUNT(*) as c FROM expenses WHERE merchant != '' GROUP BY LOWER(merchant) ORDER BY c DESC LIMIT 80`
    ).all() as { merchant: string; c: number }[];
    return NextResponse.json(rows.map(r => r.merchant));
  }

  const category = searchParams.get('category');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const search = searchParams.get('search');

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
  if (search) {
    query += ' AND (merchant LIKE ? OR description LIKE ? OR category LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 500);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;

  const baseQuery = query;
  const baseParams = [...params];

  // Count matching rows
  const countQ = baseQuery.replace('SELECT *', 'SELECT COUNT(*) as cnt');
  const { cnt: total } = db.prepare(countQ).get(...baseParams) as { cnt: number };

  query += ` ORDER BY date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`;
  const expenses = db.prepare(query).all(...params) as Expense[];

  return NextResponse.json(expenses, {
    headers: { 'X-Total-Count': String(total), 'X-Offset': String(offset), 'X-Limit': String(limit) },
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const {
    amount, currency = 'INR', merchant = '', category = 'Other',
    date, description = '', source = 'manual', transaction_type = 'expense',
  } = body;

  if (!amount || !date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 });
  }

  const validType = (TRANSACTION_TYPES as readonly string[]).includes(transaction_type) ? transaction_type : 'expense';

  const result = db.prepare(`
    INSERT INTO expenses (amount, currency, merchant, category, date, description, source, transaction_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(amount, currency, merchant, category, date, description, source, validType);

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid) as Expense;
  return NextResponse.json(created, { status: 201 });
}
