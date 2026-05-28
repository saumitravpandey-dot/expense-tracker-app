'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Nav from '@/components/Nav';
import CategoryBadge from '@/components/CategoryBadge';
import { CATEGORIES, TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG } from '@/lib/types';
import type { Expense } from '@/lib/types';

interface EditState {
  id: number;
  amount: string;
  currency: string;
  merchant: string;
  category: string;
  date: string;
  description: string;
  transaction_type: string;
}

function thisMonth() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = now.toISOString().split('T')[0];
  return { from, to };
}

function lastMonth() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from, to };
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading…</div>}>
      <ExpensesPageInner />
    </Suspense>
  );
}

function ExpensesPageInner() {
  const sp = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [category, setCategory] = useState(sp.get('category') ?? 'All');
  const [txType, setTxType] = useState('all');
  const [from, setFrom] = useState(sp.get('from') ?? '');
  const [to, setTo] = useState(sp.get('to') ?? '');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [sortCol, setSortCol] = useState<'date' | 'amount' | 'merchant' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 50;

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchExpenses(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function buildParams(offset = 0) {
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (txType !== 'all') params.set('txType', txType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search.trim()) params.set('search', search.trim());
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));
    return params;
  }

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const res = await fetch(`/api/expenses?${buildParams(0)}`);
    const data = await res.json();
    setExpenses(data);
    setTotalCount(parseInt(res.headers.get('X-Total-Count') ?? '0', 10));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, txType, from, to, search]);

  async function loadMore() {
    setLoadingMore(true);
    const res = await fetch(`/api/expenses?${buildParams(expenses.length)}`);
    const data = await res.json();
    setExpenses(prev => [...prev, ...data]);
    setLoadingMore(false);
  }

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function startEdit(e: Expense) {
    setEditing({
      id: e.id,
      amount: String(e.amount),
      currency: e.currency,
      merchant: e.merchant,
      category: e.category,
      date: e.date,
      description: e.description,
      transaction_type: (e as Expense & { transaction_type?: string }).transaction_type ?? 'expense',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/expenses/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(editing.amount),
        currency: editing.currency,
        merchant: editing.merchant,
        category: editing.category,
        date: editing.date,
        description: editing.description,
        transaction_type: editing.transaction_type,
      }),
    });
    if (res.ok) {
      const updated: Expense = await res.json();
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
      setEditing(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this expense?')) return;
    setDeleting(id);
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    setExpenses(prev => prev.filter(e => e.id !== id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    setDeleting(null);
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected expense${selected.size !== 1 ? 's' : ''}?`)) return;
    setBulkDeleting(true);
    await Promise.all([...selected].map(id => fetch(`/api/expenses/${id}`, { method: 'DELETE' })));
    setExpenses(prev => prev.filter(e => !selected.has(e.id)));
    setSelected(new Set());
    setBulkDeleting(false);
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleSelectAll() {
    if (selected.size === expenses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(expenses.map(e => e.id)));
    }
  }

  function applyThisMonth() {
    const r = thisMonth(); setFrom(r.from); setTo(r.to);
  }
  function applyLastMonth() {
    const r = lastMonth(); setFrom(r.from); setTo(r.to);
  }

  async function exportCsv() {
    // Export all matching rows (not just loaded page) via server
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (txType !== 'all') params.set('txType', txType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search.trim()) params.set('search', search.trim());
    params.set('limit', '500');
    params.set('offset', '0');
    const res = await fetch(`/api/expenses?${params}`);
    const all: (Expense & { transaction_type?: string })[] = await res.json();
    const header = 'Date,Merchant,Category,Type,Amount,Currency,Description,Source';
    const rows = all.map(e =>
      [e.date, `"${e.merchant}"`, `"${e.category}"`, e.transaction_type ?? 'expense', e.amount, e.currency, `"${e.description}"`, e.source].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${from || 'all'}-${to || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const sortedExpenses = [...expenses].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'date') cmp = a.date.localeCompare(b.date);
    else if (sortCol === 'amount') cmp = a.amount - b.amount;
    else if (sortCol === 'merchant') cmp = a.merchant.localeCompare(b.merchant);
    else if (sortCol === 'category') cmp = a.category.localeCompare(b.category);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold">All Expenses</h1>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="text-sm px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} selected`}
              </button>
            )}
            <button onClick={exportCsv} className="text-sm px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by merchant, category, or description…"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900">
                <option>All</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={txType} onChange={e => setTxType(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900">
                <option value="all">All Types</option>
                {TRANSACTION_TYPES.map(t => (
                  <option key={t} value={t}>{TRANSACTION_TYPE_CONFIG[t].label}</option>
                ))}
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
            <button onClick={fetchExpenses} className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Filter</button>
            <button onClick={() => { setCategory('All'); setTxType('all'); setFrom(''); setTo(''); setSearch(''); }}
              className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Clear</button>
          </div>

          {/* Quick date filters */}
          <div className="flex gap-2 pt-1">
            <span className="text-xs text-gray-400 self-center">Quick:</span>
            <button onClick={applyThisMonth}
              className="text-xs px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950">
              This Month
            </button>
            <button onClick={applyLastMonth}
              className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Last Month
            </button>
          </div>
        </div>

        {/* Summary */}
        {!loading && expenses.length > 0 && (
          <p className="text-sm text-gray-500 mb-3">
            Showing {expenses.length}{totalCount > expenses.length ? ` of ${totalCount}` : ''} expense{totalCount !== 1 ? 's' : ''} · Total:{' '}
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
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={expenses.length > 0 && selected.size === expenses.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <SortTh col="date" label="Date" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3 text-left" />
                  <SortTh col="merchant" label="Merchant" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3 text-left" />
                  <SortTh col="category" label="Category" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3 text-left" />
                  <th className="hidden sm:table-cell px-4 py-3 text-left">Type</th>
                  <SortTh col="amount" label="Amount" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3 text-right" />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedExpenses.map(e => (
                  editing?.id === e.id ? (
                    /* ── Inline edit row ── */
                    <tr key={e.id} className="bg-emerald-50 dark:bg-emerald-950/30">
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} className="rounded" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="date" value={editing.date} onChange={ev => setEditing(s => s && ({ ...s, date: ev.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900" />
                      </td>
                      <td className="px-2 py-2" colSpan={1}>
                        <input type="text" value={editing.merchant} placeholder="Merchant"
                          onChange={ev => setEditing(s => s && ({ ...s, merchant: ev.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900" />
                        <input type="text" value={editing.description} placeholder="Description"
                          onChange={ev => setEditing(s => s && ({ ...s, description: ev.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 mt-1" />
                      </td>
                      <td className="px-2 py-2">
                        <select value={editing.category} onChange={ev => setEditing(s => s && ({ ...s, category: ev.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900">
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="hidden sm:table-cell px-2 py-2">
                        <select value={editing.transaction_type} onChange={ev => setEditing(s => s && ({ ...s, transaction_type: ev.target.value }))}
                          className="border border-gray-300 dark:border-gray-700 rounded px-1 py-1 text-xs bg-white dark:bg-gray-900">
                          {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{TRANSACTION_TYPE_CONFIG[t].label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <select value={editing.currency} onChange={ev => setEditing(s => s && ({ ...s, currency: ev.target.value }))}
                            className="border border-gray-300 dark:border-gray-700 rounded px-1 py-1 text-xs bg-white dark:bg-gray-900 w-16">
                            {['INR','USD','EUR','GBP','SGD','AED'].map(c => <option key={c}>{c}</option>)}
                          </select>
                          <input type="number" value={editing.amount} step="0.01"
                            onChange={ev => setEditing(s => s && ({ ...s, amount: ev.target.value }))}
                            className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 w-24 text-right" />
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right space-x-2">
                        <button onClick={saveEdit} disabled={saving}
                          className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 disabled:opacity-50">
                          {saving ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    /* ── Normal row ── */
                    <tr key={e.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected.has(e.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} className="rounded" />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e.date}</td>
                      <td className="px-4 py-3 font-medium">
                        {e.merchant || <span className="text-gray-400 italic">—</span>}
                        {e.description && <p className="text-xs text-gray-400 font-normal">{e.description}</p>}
                      </td>
                      <td className="px-4 py-3"><CategoryBadge category={e.category} /></td>
                      <td className="hidden sm:table-cell px-4 py-3">
                        <TxTypeBadge type={(e as Expense & { transaction_type?: string }).transaction_type ?? 'expense'} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        <span className={(e as Expense & { transaction_type?: string }).transaction_type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                          {(e as Expense & { transaction_type?: string }).transaction_type === 'income' ? '+' : ''}{e.currency} {e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-3">
                        <button onClick={() => startEdit(e)} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
                        <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
                          {deleting === e.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {!loading && expenses.length > 0 && expenses.length < totalCount && (
          <div className="text-center pt-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : `Load more (${totalCount - expenses.length} remaining)`}
            </button>
          </div>
        )}
      </main>
    </>
  );
}

function SortTh({ col, label, sortCol, sortDir, onSort, className }: {
  col: 'date' | 'amount' | 'merchant' | 'category';
  label: string;
  sortCol: string;
  sortDir: 'asc' | 'desc';
  onSort: (col: 'date' | 'amount' | 'merchant' | 'category') => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th className={className}>
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 font-medium uppercase tracking-wide text-xs ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
      >
        {label}
        <span className="text-[10px]">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇕'}</span>
      </button>
    </th>
  );
}

function TxTypeBadge({ type }: { type: string }) {
  const cfg = TRANSACTION_TYPE_CONFIG[type as keyof typeof TRANSACTION_TYPE_CONFIG];
  if (!cfg || type === 'expense') return null;
  return (
    <span
      className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: cfg.color + '22', color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
