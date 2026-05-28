'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/types';
import type { Budget } from '@/app/api/budgets/route';
import type { Recommendation } from '@/app/api/budgets/recommend/route';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spends, setSpends] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecs, setShowRecs] = useState(false);
  const [applyingRecs, setApplyingRecs] = useState(false);

  useEffect(() => {
    fetch('/api/budgets').then(r => r.json()).then(setBudgets);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    fetch(`/api/budgets/progress?month=${month}`)
      .then(r => r.json())
      .then((rows: { category: string; total: number; currency: string }[]) => {
        const map: Record<string, number> = {};
        for (const r of rows) {
          map[r.category] = r.total;
          if (r.currency) setCurrency(r.currency);
        }
        setSpends(map);
      });

    fetch('/api/budgets/recommend').then(r => r.json()).then(setRecommendations).catch(() => {});
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

  async function applyRecommendations() {
    const unset = recommendations.filter(r => !getBudget(r.category));
    if (unset.length === 0) return;
    setApplyingRecs(true);
    for (const r of unset) {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: r.category, amount: r.suggestedBudget, currency: r.currency }),
      });
    }
    const fresh = await fetch('/api/budgets').then(r => r.json());
    setBudgets(fresh);
    setApplyingRecs(false);
    setShowRecs(false);
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
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold mb-1">Monthly Budgets</h1>
              <p className="text-sm text-gray-500">Set a spending limit per category. The dashboard will show your progress.</p>
            </div>
            {recommendations.length > 0 && (
              <button
                onClick={() => setShowRecs(s => !s)}
                className="text-sm px-4 py-2 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                ✨ Suggest from history ({recommendations.length})
              </button>
            )}
          </div>

          {showRecs && recommendations.length > 0 && (
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-3">
                Based on your last 3 months of spending:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {recommendations.map(r => (
                  <div key={r.category} className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-gray-500 truncate">{r.category}</p>
                    <p className="text-sm font-semibold">{r.currency} {r.suggestedBudget.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-400">avg {r.currency} {r.avgMonthly.toLocaleString('en-IN')}/mo</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyRecommendations}
                  disabled={applyingRecs}
                  className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {applyingRecs ? 'Applying…' : `Apply ${recommendations.filter(r => !getBudget(r.category)).length} unset budgets`}
                </button>
                <button onClick={() => setShowRecs(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                  Dismiss
                </button>
              </div>
            </div>
          )}
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
