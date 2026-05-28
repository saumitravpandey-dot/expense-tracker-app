'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '@/components/Nav';
import CategoryBadge from '@/components/CategoryBadge';
import { CATEGORIES } from '@/lib/types';
import type { Expense } from '@/lib/types';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/expenses?${params}`);
    setExpenses(await res.json());
    setLoading(false);
  }, [category, from, to]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function handleDelete(id: number) {
    if (!confirm('Delete this expense?')) return;
    setDeleting(id);
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    setExpenses(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  }

  function exportCsv() {
    const header = 'Date,Merchant,Category,Amount,Currency,Description,Source';
    const rows = expenses.map(e =>
      [e.date, `"${e.merchant}"`, `"${e.category}"`, e.amount, e.currency, `"${e.description}"`, e.source].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">All Expenses</h1>
          <button
            onClick={exportCsv}
            className="text-sm px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900"
            >
              <option>All</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900" />
          </div>
          <button onClick={fetchExpenses} className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">
            Filter
          </button>
          <button onClick={() => { setCategory('All'); setFrom(''); setTo(''); }}
            className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            Clear
          </button>
        </div>

        {/* Summary */}
        {!loading && expenses.length > 0 && (
          <p className="text-sm text-gray-500 mb-3">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''} · Total:{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {expenses[0]?.currency} {total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </p>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No expenses found.</div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Merchant</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-500">{e.date}</td>
                    <td className="px-4 py-3 font-medium">
                      {e.merchant || <span className="text-gray-400 italic">—</span>}
                      {e.description && <p className="text-xs text-gray-400 font-normal">{e.description}</p>}
                    </td>
                    <td className="px-4 py-3"><CategoryBadge category={e.category} /></td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {e.currency} {e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 capitalize">{e.source}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                      >
                        {deleting === e.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
