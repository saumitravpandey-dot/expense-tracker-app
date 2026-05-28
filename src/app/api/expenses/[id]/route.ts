import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { TRANSACTION_TYPES } from '@/lib/types';
import type { Expense } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { amount, currency, merchant, category, date, description, transaction_type } = body;

  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const validType = transaction_type && (TRANSACTION_TYPES as readonly string[]).includes(transaction_type)
    ? transaction_type
    : (existing as Expense & { transaction_type?: string }).transaction_type ?? 'expense';

  db.prepare(`
    UPDATE expenses SET
      amount = ?, currency = ?, merchant = ?, category = ?, date = ?, description = ?, transaction_type = ?
    WHERE id = ?
  `).run(
    amount ?? existing.amount,
    currency ?? existing.currency,
    merchant ?? existing.merchant,
    category ?? existing.category,
    date ?? existing.date,
    description ?? existing.description,
    validType,
    id,
  );

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return new NextResponse(null, { status: 204 });
}
