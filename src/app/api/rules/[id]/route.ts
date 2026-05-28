import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM transaction_rules WHERE id = ?').get(Number(id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields = ['pattern', 'match_type', 'apply_to', 'tx_type', 'category', 'action', 'enabled'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(body[f]);
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  values.push(Number(id));
  db.prepare(`UPDATE transaction_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM transaction_rules WHERE id = ?').get(Number(id));
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM transaction_rules WHERE id = ?').get(Number(id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare('DELETE FROM transaction_rules WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
