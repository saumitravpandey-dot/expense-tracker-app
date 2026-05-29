import Link from 'next/link';
import Nav from '@/components/Nav';
import CategoryBadge from '@/components/CategoryBadge';
import MonthNav from '@/components/MonthNav';
import BudgetAlertBanner from '@/components/BudgetAlertBanner';
import { getDb } from '@/lib/db';
import { CATEGORY_COLORS } from '@/lib/types';
import type { Expense } from '@/lib/types';

interface CategoryTotal { category: string; total: number; }
interface Budget { category: string; amount: number; currency: string; }

function parseMonth(raw: string | undefined): string {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return current;
  return raw;
}

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  const start = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = parseMonth(sp.month);

  try {
    return <DashboardInner month={month} />;
  } catch {
    return (
      <>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-400 mb-4">Could not load dashboard data.</p>
          <Link href="/add" className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + Add your first expense
          </Link>
        </main>
      </>
    );
  }
}

function DashboardInner({ month }: { month: string }) {
  const db = getDb();
  const { start: monthStart, end: monthEnd } = monthRange(month);

  const monthExpenses = (db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type != 'income'`
  ).get(monthStart, monthEnd) as { total: number }).total;

  const monthIncome = (db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type = 'income'`
  ).get(monthStart, monthEnd) as { total: number }).total;

  const currency = (db.prepare(`SELECT currency FROM expenses ORDER BY id DESC LIMIT 1`).get() as { currency: string } | undefined)?.currency ?? 'INR';

  const byCategory = db.prepare(
    `SELECT category, SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type != 'income' GROUP BY category ORDER BY total DESC`
  ).all(monthStart, monthEnd) as CategoryTotal[];

  const budgets = db.prepare(`SELECT * FROM budgets`).all() as Budget[];
  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = b.amount;

  const overBudgetAlerts = byCategory
    .filter(c => budgetMap[c.category] && c.total > budgetMap[c.category])
    .map(c => ({ category: c.category, spent: c.total, budget: budgetMap[c.category], currency }));
  const overBudgetCount = overBudgetAlerts.length;

  const recent = db.prepare(
    `SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 8`
  ).all(monthStart, monthEnd) as Expense[];

  const allTimeTotal = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE transaction_type != 'income'`).get() as { total: number }).total;
  const count = (db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE transaction_type != 'income'`).get() as { c: number }).c;

  // Previous month for trend comparison
  const [py, pm] = month.split('-').map(Number);
  const prevDate = new Date(py, pm - 2, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const { start: prevStart, end: prevEnd } = monthRange(prevYM);
  const prevExpenses = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type != 'income'`).get(prevStart, prevEnd) as { total: number }).total;
  const prevIncome = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type = 'income'`).get(prevStart, prevEnd) as { total: number }).total;

  // Top merchants for selected month
  const topMerchants = db.prepare(`
    SELECT merchant, SUM(amount) as total, COUNT(*) as cnt
    FROM expenses
    WHERE date >= ? AND date <= ? AND merchant != '' AND transaction_type != 'income'
    GROUP BY merchant ORDER BY total DESC LIMIT 5
  `).all(monthStart, monthEnd) as { merchant: string; total: number; cnt: number }[];

  // Spending velocity (current month only)
  const now = new Date();
  const isCurrentMonth = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysElapsed = isCurrentMonth ? now.getDate() : new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getDate();
  const totalDays = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getDate();
  const dailyAvg = daysElapsed > 0 ? monthExpenses / daysElapsed : 0;
  const projectedMonthly = dailyAvg * totalDays;

  const maxCat = byCategory[0]?.total ?? 1;

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Month picker header */}
        <div className="flex items-center justify-between">
          <MonthNav month={month} />
          <p className="text-xs text-gray-400">{count} total expense{count !== 1 ? 's' : ''} · {currency} {allTimeTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })} all time</p>
        </div>

        {/* Budget alert banner (client — dismissable) */}
        {overBudgetAlerts.length > 0 && (
          <BudgetAlertBanner alerts={overBudgetAlerts} month={month} />
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Spent"
            value={`${currency} ${monthExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            sub="expenses this month"
            trend={prevExpenses > 0 ? { pct: Math.round(((monthExpenses - prevExpenses) / prevExpenses) * 100), positiveIsGood: false } : null}
          />
          <StatCard
            label="Income"
            value={monthIncome > 0 ? `${currency} ${monthIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            sub={monthIncome > 0 ? 'credited' : 'Add income →'}
            href={monthIncome === 0 ? '/add' : undefined}
            trend={prevIncome > 0 && monthIncome > 0 ? { pct: Math.round(((monthIncome - prevIncome) / prevIncome) * 100), positiveIsGood: true } : null}
          />
          <StatCard
            label="Net Savings"
            value={monthIncome > 0 ? `${currency} ${(monthIncome - monthExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            sub={monthIncome > 0 ? `${Math.max(0, Math.round(((monthIncome - monthExpenses) / monthIncome) * 100))}% saved` : 'Track income to see'}
            alert={monthIncome > 0 && monthIncome < monthExpenses}
          />
          <StatCard
            label="Budget Alerts"
            value={overBudgetCount > 0 ? `${overBudgetCount} over` : budgets.length > 0 ? 'On track ✓' : 'None set'}
            sub={budgets.length > 0 ? `${budgets.length} budget${budgets.length !== 1 ? 's' : ''} active` : 'Set budgets →'}
            alert={overBudgetCount > 0}
            href="/budgets"
          />
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Category breakdown with budget bars */}
          <div className="col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">By Category</h2>
              <Link href="/budgets" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Budgets →</Link>
            </div>
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No data for this month</p>
            ) : (
              <div className="space-y-3">
                {byCategory.map(c => {
                  const budget = budgetMap[c.category];
                  const pct = budget
                    ? Math.min(Math.round((c.total / budget) * 100), 100)
                    : Math.round((c.total / maxCat) * 100);
                  const over = budget && c.total > budget;
                  const warn = budget && !over && (c.total / budget) >= 0.8;
                  const color = over ? '#ef4444' : warn ? '#eab308' : (CATEGORY_COLORS[c.category] ?? '#6b7280');

                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <Link href={`/expenses?from=${monthStart}&to=${monthEnd}&category=${encodeURIComponent(c.category)}`} className="truncate mr-2 flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400">
                          {over && <span className="text-red-500 text-xs">!</span>}
                          {c.category}
                        </Link>
                        <span className={`font-mono text-xs shrink-0 ${over ? 'text-red-500' : warn ? 'text-yellow-600' : 'text-gray-500'}`}>
                          {currency} {c.total.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                          {budget ? <span className="text-gray-400">/{budget.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span> : null}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent expenses for selected month */}
          <div className="col-span-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Transactions</h2>
              <Link href={`/expenses?from=${monthStart}&to=${monthEnd}`} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">View all →</Link>
            </div>
            {recent.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm mb-4">No transactions this month.</p>
                <Link href="/add" className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  + Add expense
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map(e => (
                  <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.merchant || e.description || 'Expense'}</p>
                      <p className="text-xs text-gray-400">{e.date}</p>
                    </div>
                    <CategoryBadge category={e.category} />
                    <span className={`font-mono text-sm font-semibold shrink-0 ${(e as Expense & { transaction_type?: string }).transaction_type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {(e as Expense & { transaction_type?: string }).transaction_type === 'income' ? '+' : ''}{e.currency} {e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top merchants + spending velocity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topMerchants.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-4">Top Merchants</h2>
              <div className="space-y-2.5">
                {topMerchants.map((m, i) => (
                  <div key={m.merchant} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 shrink-0 font-mono">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium truncate">{m.merchant}</span>
                    <span className="text-xs text-gray-400 shrink-0">{m.cnt}×</span>
                    <span className="font-mono text-sm font-semibold shrink-0">
                      {currency} {Math.round(m.total).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCurrentMonth && daysElapsed > 0 && monthExpenses > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-4">Spending Velocity</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Daily average</p>
                    <p className="text-2xl font-bold">{currency} {Math.round(dailyAvg).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Day {daysElapsed} of {totalDays}</p>
                    <p className="text-sm text-gray-400">{Math.round((daysElapsed / totalDays) * 100)}% of month</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Projected month-end</span>
                    <span className={`font-semibold ${projectedMonthly > monthExpenses * 1.2 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      {currency} {Math.round(projectedMonthly).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.round((daysElapsed / totalDays) * 100))}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {currency} {Math.round(monthExpenses).toLocaleString('en-IN')} spent in {daysElapsed} day{daysElapsed !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          <Link href="/add" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            + Add Expense
          </Link>
          <Link href="/import" className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-3 rounded-xl transition-colors">
            ⬆ Import Statement
          </Link>
          <Link href="/trends" className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-3 rounded-xl transition-colors">
            📊 Trends
          </Link>
        </div>

      </main>
    </>
  );
}

function StatCard({
  label, value, sub, alert, href, trend,
}: {
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
  href?: string;
  trend?: { pct: number; positiveIsGood: boolean } | null;
}) {
  const trendUp = trend && trend.pct > 0;
  const trendGood = trend && (trend.positiveIsGood ? trendUp : !trendUp);
  const trendColor = trendGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  const inner = (
    <div className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 transition-colors ${
      alert ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-800'
    } ${href ? 'hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer' : ''}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold truncate ${alert ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-xs text-gray-400">{sub}</p>
        {trend && trend.pct !== 0 && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend.pct)}%
          </span>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
