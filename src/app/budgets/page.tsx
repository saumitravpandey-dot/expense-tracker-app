'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/types';
import type { Budget } from '@/app/api/budgets/route';

interface CategorySpend { category: string; total: number; }

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spends, setSpends] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');

  useEffect(() => {
    fetch('/api/budgets').then(r => r.json()).then(setBudgets);

    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = now.toISOString().split('T')[0];

    fetch(`/api/expenses?from=${from}&to=${to}`)
      .then(r => r.json())
      .then((expenses: { category: string; amount: number; currency: string }[]) => {
        const map: Record<string, number> = {};
        for (const e of expenses) {
          map[e.category] = (map[e.category] ?? 0) + e.amount;
          if (e.currency) setCurrency(e.currency);
        }
        setSpends(map);
      });
  }, []);

  function getBudget(cat: string) {
    return budgets.find(b => b.category === cat);
  }

  function editValue(cat: string) {
    return editing[cat] ?? getBudget(cat)?.amount?.toString() ?? '';
  }

  async function saveBudget(category: string) {
    const amount = parseFloat(editing[category] ?? '');
    if (!amount || amount <= 0) return;
    setSaving(category);
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount, currency }),
    });
    const saved: Budget = await res.json();
    setBudgets(prev => {
      const filtered = prev.filter(b => b.category !== category);
      return [...filtered, saved].sort((a, b) => a.category.localeCompare(b.category));
    });
    setSaving(null);
  }

  async function removeBudget(category: string) {
    await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    setBudgets(prev => prev.filter(b => b.category !== category));
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Monthly Budgets</h1>
          <p className="text-sm text-gray-500">Set a spending limit per category. The dashboard will show your progress.</p>
        </div>

        <div className="space-y-3">
          {CATEGORIES.map(cat => {
            const budget = getBudget(cat);
            const spent = spends[cat] ?? 0;
            const limit = budget?.amount ?? 0;
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const over = limit > 0 && spent > limit;
            const warn = limit > 0 && pct >= 80 && !over;
            const color = CATEGORY_COLORS[cat] ?? '#6b7280';

            return (
              <div key={cat} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium flex-1 min-w-[140px]">{cat}</span>

                  {/* Spent this month */}
                  <span className={`text-sm font-mono shrink-0 ${over ? 'text-red-600' : warn ? 'text-yellow-600' : 'text-gray-500'}`}>
                    {currency} {spent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    {limit > 0 && <span className="text-gray-400"> / {limit.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>}
                  </span>

                  {/* Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="No limit"
                      value={editValue(cat)}
                      onChange={e => setEditing(prev => ({ ...prev, [cat]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveBudget(cat)}
                      className="w-28 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={() => saveBudget(cat)}
                      disabled={saving === cat || !editing[cat]}
                      className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg"
                    >
                      {saving === cat ? '…' : 'Set'}
                    </button>
                    {budget && (
                      <button onClick={() => removeBudget(cat)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {limit > 0 && (
                  <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : warn ? 'bg-yellow-400' : ''}`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: over ? undefined : warn ? undefined : color,
                      }}
                    />
                  </div>
                )}

                {over && (
                  <p className="text-xs text-red-500 mt-1">
                    Over budget by {currency} {(spent - limit).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
