import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const format = new URL(req.url).searchParams.get('format');

  const expenses = db.prepare('SELECT * FROM expenses ORDER BY date ASC, id ASC').all();
  const budgets = db.prepare('SELECT * FROM budgets').all();
  const rules = db.prepare('SELECT * FROM transaction_rules').all();

  if (format === 'csv') {
    const header = 'Date,Merchant,Category,Type,Amount,Currency,Description,Source,Created';
    const rows = (expenses as Array<{
      date: string; merchant: string; category: string; transaction_type?: string;
      amount: number; currency: string; description: string; source: string; created_at: string;
    }>).map(e => [
      e.date,
      `"${(e.merchant ?? '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.transaction_type ?? 'expense',
      e.amount,
      e.currency,
      `"${(e.description ?? '').replace(/"/g, '""')}"`,
      e.source,
      e.created_at,
    ].join(','));

    return new NextResponse([header, ...rows].join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
    budgets,
    rules,
  });
}
