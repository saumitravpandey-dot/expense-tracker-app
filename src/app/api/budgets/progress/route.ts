import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }

  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

  const db = getDb();
  const rows = db.prepare(`
    SELECT category, SUM(amount) as total, MAX(currency) as currency
    FROM expenses
    WHERE date >= ? AND date <= ? AND transaction_type NOT IN ('income', 'transfer')
    GROUP BY category
  `).all(start, end) as { category: string; total: number; currency: string }[];

  return NextResponse.json(rows);
}
