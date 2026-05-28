import Link from 'next/link';
import Nav from '@/components/Nav';
import CategoryBadge from '@/components/CategoryBadge';
import { getDb } from '@/lib/db';
import { CATEGORY_COLORS } from '@/lib/types';
import type { Expense } from '@/lib/types';

interface CategoryTotal { category: string; total: number; }
interface Budget { category: string; amount: number; currency: string; }

function Dashboard() {
  try {
    return <DashboardInner />;
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

function DashboardInner() {
  const db = getDb();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const monthTotal = (db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ?`
  ).get(monthStart, monthEnd) as { total: number }).total;

  const currency = (db.prepare(`SELECT currency FROM expenses ORDER BY id DESC LIMIT 1`).get() as { currency: string } | undefined)?.currency ?? 'INR';

  const byCategory = db.prepare(
    `SELECT category, SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC`
  ).all(monthStart, monthEnd) as CategoryTotal[];

  const budgets = db.prepare(`SELECT * FROM budgets`).all() as Budget[];
  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = b.amount;

  const overBudgetCount = byCategory.filter(c => budgetMap[c.category] && c.total > budgetMap[c.category]).length;

  const recent = db.prepare(
    `SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT 8`
  ).all() as Expense[];

  const allTimeTotal = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`).get() as { total: number }).total;
  const count = (db.prepare(`SELECT COUNT(*) as c FROM expenses`).get() as { c: number }).c;

  const maxCat = byCategory[0]?.total ?? 1;

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="This Month" value={`${currency} ${monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sub={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} />
          <StatCard label="All Time" value={`${currency} ${allTimeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sub={`${count} expense${count !== 1 ? 's' : ''} recorded`} />
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
              <h2 className="font-semibold">This Month</h2>
              <Link href="/budgets" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Budgets →</Link>
            </div>
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
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
                        <span className="truncate mr-2 flex items-center gap-1">
                          {over && <span className="text-red-500 text-xs">!</span>}
                          {c.category}
                        </span>
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

          {/* Recent expenses */}
          <div className="col-span-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent Expenses</h2>
              <Link href="/expenses" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">View all →</Link>
            </div>
            {recent.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm mb-4">No expenses yet.</p>
                <Link href="/add" className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  + Add your first expense
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
                    <span className="font-mono text-sm font-semibold shrink-0">
                      {e.currency} {e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          <Link href="/add" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            + Add Expense
          </Link>
          <Link href="/import" className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-3 rounded-xl transition-colors">
            ⬆ Import Statement
          </Link>
          <Link href="/expenses" className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-3 rounded-xl transition-colors">
            View All
          </Link>
        </div>

      </main>
    </>
  );
}

function StatCard({
  label, value, sub, alert, href,
}: {
  label: string; value: string; sub: string; alert?: boolean; href?: string;
}) {
  const inner = (
    <div className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 transition-colors ${
      alert ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-800'
    } ${href ? 'hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer' : ''}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold truncate ${alert ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default Dashboard;
