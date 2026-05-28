import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Expense } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const { amount, currency, merchant, category, date, description } = body;

  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(`
    UPDATE expenses SET
      amount = ?, currency = ?, merchant = ?, category = ?, date = ?, description = ?
    WHERE id = ?
  `).run(
    amount ?? existing.amount,
    currency ?? existing.currency,
    merchant ?? existing.merchant,
    category ?? existing.category,
    date ?? existing.date,
    description ?? existing.description,
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
