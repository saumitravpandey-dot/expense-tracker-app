import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface Row {
  merchant: string;
  year_month: string;
  avg_amount: number;
  txn_count: number;
}

export interface DetectedSubscription {
  merchant: string;
  monthlyAmount: number;
  currency: string;
  months: string[];
  lastDate: string;
  category: string;
}

export async function GET() {
  const db = getDb();

  // Group by merchant + month, looking at last 6 months, expense type only
  const rows = db.prepare(`
    SELECT
      LOWER(TRIM(merchant)) as merchant,
      strftime('%Y-%m', date) as year_month,
      AVG(amount) as avg_amount,
      COUNT(*) as txn_count,
      MAX(date) as last_date,
      MAX(category) as category,
      MAX(currency) as currency
    FROM expenses
    WHERE
      merchant != ''
      AND transaction_type IN ('expense', 'insurance', 'loan_emi', 'bank_fee')
      AND date >= date('now', '-6 months')
    GROUP BY LOWER(TRIM(merchant)), strftime('%Y-%m', date)
    HAVING AVG(amount) > 0
    ORDER BY merchant, year_month
  `).all() as (Row & { last_date: string; category: string; currency: string })[];

  // Group by merchant to find those appearing in 2+ distinct months
  const byMerchant = new Map<string, (Row & { last_date: string; category: string; currency: string })[]>();
  for (const r of rows) {
    if (!byMerchant.has(r.merchant)) byMerchant.set(r.merchant, []);
    byMerchant.get(r.merchant)!.push(r);
  }

  const subscriptions: DetectedSubscription[] = [];

  for (const [merchant, monthRows] of byMerchant) {
    if (monthRows.length < 2) continue;

    const amounts = monthRows.map(r => r.avg_amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map(a => Math.abs(a - avgAmount) / avgAmount));

    // Only flag as subscription if amounts are within 10% of each other (consistent charge)
    if (maxDeviation > 0.1) continue;

    const last = monthRows[monthRows.length - 1];
    subscriptions.push({
      merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
      monthlyAmount: Math.round(avgAmount * 100) / 100,
      currency: last.currency,
      months: monthRows.map(r => r.year_month),
      lastDate: last.last_date,
      category: last.category,
    });
  }

  // Sort by monthly amount descending
  subscriptions.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  return NextResponse.json(subscriptions.slice(0, 20));
}
