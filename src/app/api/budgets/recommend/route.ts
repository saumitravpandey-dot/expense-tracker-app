import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export interface Recommendation {
  category: string;
  avgMonthly: number;
  suggestedBudget: number;
  currency: string;
  months: number;
}

export async function GET() {
  const db = getDb();

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rows = db.prepare(`
    SELECT
      category,
      AVG(monthly_total) as avg_monthly,
      COUNT(DISTINCT month) as months_with_data,
      MAX(currency) as currency
    FROM (
      SELECT
        category,
        strftime('%Y-%m', date) as month,
        SUM(amount) as monthly_total,
        MAX(currency) as currency
      FROM expenses
      WHERE
        date >= ?
        AND strftime('%Y-%m', date) != ?
        AND transaction_type NOT IN ('income', 'transfer')
      GROUP BY category, strftime('%Y-%m', date)
    )
    GROUP BY category
    HAVING months_with_data >= 2
    ORDER BY avg_monthly DESC
  `).all(threeMonthsAgo, currentMonth) as { category: string; avg_monthly: number; months_with_data: number; currency: string }[];

  const recommendations: Recommendation[] = rows.map(r => ({
    category: r.category,
    avgMonthly: Math.round(r.avg_monthly),
    // Suggest 10% more than average to be realistic but aspirational
    suggestedBudget: Math.ceil((r.avg_monthly * 1.1) / 100) * 100,
    currency: r.currency,
    months: r.months_with_data,
  }));

  return NextResponse.json(recommendations);
}
