import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { TRANSACTION_TYPES } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM transaction_rules ORDER BY id ASC').all();
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pattern, match_type, apply_to, tx_type, category, action } = body;

  if (!pattern || !match_type || !apply_to || !tx_type || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!TRANSACTION_TYPES.includes(tx_type)) {
    return NextResponse.json({ error: 'Invalid tx_type' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO transaction_rules (pattern, match_type, apply_to, tx_type, category, action) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(pattern, match_type, apply_to, tx_type, category ?? '', action);

  const row = db.prepare('SELECT * FROM transaction_rules WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
