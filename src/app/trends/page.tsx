import Link from 'next/link';
import Nav from '@/components/Nav';
import CategoryBadge from '@/components/CategoryBadge';
import { getDb } from '@/lib/db';
import { CATEGORY_COLORS } from '@/lib/types';

interface MonthRow { month: string; total: number; }
interface MerchantRow { merchant: string; total: number; count: number; }
interface DowRow { dow: number; total: number; }
interface CategoryRow { category: string; total: number; }

function pad(n: number) { return String(n).padStart(2, '0'); }

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TrendsPage() {
  const db = getDb();

  const now = new Date();
  const currency = (db.prepare(`SELECT currency FROM expenses ORDER BY id DESC LIMIT 1`).get() as { currency: string } | undefined)?.currency ?? 'INR';

  // ── Last 6 months totals ──
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }

  const monthTotals = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE date >= ?
    GROUP BY month
    ORDER BY month
  `).all(`${months[0]}-01`) as MonthRow[];

  const monthMap: Record<string, number> = {};
  for (const r of monthTotals) monthMap[r.month] = r.total;
  const monthData = months.map(m => ({ month: m, total: monthMap[m] ?? 0 }));
  const maxMonth = Math.max(...monthData.map(m => m.total), 1);

  // ── This month vs last month by category ──
  const thisMonthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}`;

  const thisCats = db.prepare(`
    SELECT category, SUM(amount) as total FROM expenses
    WHERE strftime('%Y-%m', date) = ? GROUP BY category ORDER BY total DESC LIMIT 6
  `).all(thisMonthStr) as CategoryRow[];

  const lastCatsArr = db.prepare(`
    SELECT category, SUM(amount) as total FROM expenses
    WHERE strftime('%Y-%m', date) = ? GROUP BY category
  `).all(lastMonthStr) as CategoryRow[];
  const lastCatMap: Record<string, number> = {};
  for (const r of lastCatsArr) lastCatMap[r.category] = r.total;

  // ── Top 5 merchants this month ──
  const topMerchants = db.prepare(`
    SELECT merchant, SUM(amount) as total, COUNT(*) as count
    FROM expenses
    WHERE strftime('%Y-%m', date) = ? AND merchant != ''
    GROUP BY merchant ORDER BY total DESC LIMIT 5
  `).all(thisMonthStr) as MerchantRow[];

  // ── Day-of-week pattern (all time) ──
  const dowRows = db.prepare(`
    SELECT CAST(strftime('%w', date) AS INTEGER) as dow, SUM(amount) as total
    FROM expenses GROUP BY dow ORDER BY dow
  `).all() as DowRow[];
  const dowMap: Record<number, number> = {};
  for (const r of dowRows) dowMap[r.dow] = r.total;
  const maxDow = Math.max(...Object.values(dowMap), 1);

  // ── Anomaly: this month vs 3-month average ──
  const threeMonthAvg = (() => {
    const row = db.prepare(`
      SELECT AVG(monthly) as avg FROM (
        SELECT SUM(amount) as monthly FROM expenses
        WHERE date >= ? AND strftime('%Y-%m', date) != ?
        GROUP BY strftime('%Y-%m', date)
      )
    `).get(
      `${new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]}`,
      thisMonthStr
    ) as { avg: number | null };
    return row.avg ?? 0;
  })();

  const thisMonthTotal = monthMap[thisMonthStr] ?? 0;
  const anomalyPct = threeMonthAvg > 0 ? Math.round(((thisMonthTotal - threeMonthAvg) / threeMonthAvg) * 100) : null;

  const totalExpenses = (db.prepare(`SELECT COUNT(*) as c FROM expenses`).get() as { c: number }).c;

  if (totalExpenses === 0) {
    return (
      <>
        <Nav />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-xl font-semibold mb-2">No data yet</p>
          <p className="text-sm text-gray-500 mb-6">Import a bank statement or add expenses to see trends.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/import" className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700">Import Statement</Link>
            <Link href="/add" className="border border-gray-300 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800">Add Expense</Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Trends &amp; Analytics</h1>

        {/* Anomaly callout */}
        {anomalyPct !== null && Math.abs(anomalyPct) >= 15 && (
          <div className={`px-5 py-4 rounded-xl border text-sm font-medium ${
            anomalyPct > 0
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            {anomalyPct > 0
              ? `⚠ This month's spending is ${anomalyPct}% higher than your 3-month average (${currency} ${Math.round(threeMonthAvg).toLocaleString('en-IN')})`
              : `✓ This month's spending is ${Math.abs(anomalyPct)}% lower than your 3-month average — great job!`}
          </div>
        )}

        {/* 6-month bar chart */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold mb-6">Monthly Spend — Last 6 Months</h2>
          <div className="flex items-end gap-3 h-40">
            {monthData.map(m => {
              const pct = Math.round((m.total / maxMonth) * 100);
              const isCurrent = m.month === thisMonthStr;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500 font-mono">
                    {m.total > 0 ? `${Math.round(m.total / 1000)}k` : '—'}
                  </span>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden flex items-end" style={{ height: '100px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${isCurrent ? 'bg-emerald-500' : 'bg-emerald-200 dark:bg-emerald-800'}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                    {monthLabel(m.month)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* This month vs last month */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-1">This vs Last Month</h2>
            <p className="text-xs text-gray-400 mb-4">Top categories</p>
            {thisCats.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data this month</p>
            ) : (
              <div className="space-y-3">
                {thisCats.map(c => {
                  const last = lastCatMap[c.category] ?? 0;
                  const diff = last > 0 ? Math.round(((c.total - last) / last) * 100) : null;
                  return (
                    <div key={c.category} className="flex items-center justify-between gap-2">
                      <CategoryBadge category={c.category} />
                      <span className="font-mono text-sm font-semibold">
                        {currency} {Math.round(c.total).toLocaleString('en-IN')}
                      </span>
                      {diff !== null && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          diff > 0 ? 'text-red-600 bg-red-50 dark:bg-red-950' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                        }`}>
                          {diff > 0 ? '↑' : '↓'}{Math.abs(diff)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top merchants */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-1">Top Merchants</h2>
            <p className="text-xs text-gray-400 mb-4">This month</p>
            {topMerchants.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No merchant data</p>
            ) : (
              <div className="space-y-3">
                {topMerchants.map((m, i) => (
                  <div key={m.merchant} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.merchant}</p>
                      <p className="text-xs text-gray-400">{m.count} transaction{m.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold shrink-0">
                      {currency} {Math.round(m.total).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Day-of-week chart */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold mb-1">Spending by Day of Week</h2>
          <p className="text-xs text-gray-400 mb-6">All time — which days do you spend most?</p>
          <div className="flex items-end gap-3 h-28">
            {DOW.map((day, i) => {
              const val = dowMap[i] ?? 0;
              const pct = Math.round((val / maxDow) * 100);
              const isMax = val === maxDow && val > 0;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  {isMax && <span className="text-xs text-yellow-500">★</span>}
                  {!isMax && <span className="text-xs opacity-0">★</span>}
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t overflow-hidden flex items-end" style={{ height: '72px' }}>
                    <div
                      className={`w-full rounded-t transition-all ${isMax ? 'bg-yellow-400' : 'bg-blue-300 dark:bg-blue-700'}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{day}</span>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </>
  );
}
