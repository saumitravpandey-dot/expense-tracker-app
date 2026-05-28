'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import Link from 'next/link';

interface Stats {
  count: number;
  totalAmount: number;
  currency: string;
  firstDate: string | null;
  lastDate: string | null;
  budgetCount: number;
  ruleCount: number;
}

export default function SettingsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch('/api/settings/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  async function exportJson() {
    setExporting(true);
    const res = await fetch('/api/settings/export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function exportCsv() {
    const res = await fetch('/api/settings/export?format=csv');
    const csv = await res.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearData() {
    if (!confirm('This will permanently delete ALL expenses, budgets, and rules. This cannot be undone.\n\nType "DELETE" to confirm.')) return;
    const input = prompt('Type DELETE to confirm:');
    if (input !== 'DELETE') return;
    setClearing(true);
    await fetch('/api/settings/clear', { method: 'POST' });
    setStats(prev => prev ? { ...prev, count: 0, totalAmount: 0, firstDate: null, lastDate: null, budgetCount: 0, ruleCount: 0 } : null);
    setClearing(false);
    alert('All data cleared.');
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Settings & Data</h1>

        {/* DB Stats */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Database Summary</h2>
          {!stats ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatItem label="Expenses" value={stats.count.toLocaleString()} />
              <StatItem label="Total Recorded" value={`${stats.currency} ${Math.round(stats.totalAmount).toLocaleString('en-IN')}`} />
              <StatItem label="Budgets Set" value={stats.budgetCount.toString()} />
              <StatItem label="Mapping Rules" value={stats.ruleCount.toString()} />
              <StatItem label="Earliest Entry" value={stats.firstDate ?? '—'} />
              <StatItem label="Latest Entry" value={stats.lastDate ?? '—'} />
            </div>
          )}
        </section>

        {/* Export */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-1">Export Data</h2>
          <p className="text-sm text-gray-500 mb-4">Back up all your expenses, budgets, and mapping rules.</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={exportJson}
              disabled={exporting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm"
            >
              {exporting ? 'Exporting…' : 'Export JSON (full backup)'}
            </button>
            <button
              onClick={exportCsv}
              className="px-5 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-xl text-sm"
            >
              Export CSV (expenses only)
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            JSON backup includes expenses, budgets, and rules — can be imported later.
            CSV is useful for spreadsheet analysis.
          </p>
        </section>

        {/* Quick links */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Link href="/mappings" className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>⚙</span> Transaction Rules
            </Link>
            <Link href="/budgets" className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>💰</span> Budget Settings
            </Link>
            <Link href="/trends" className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>📊</span> Trends & Analytics
            </Link>
            <Link href="/import" className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>⬆</span> Import Statement
            </Link>
          </div>
        </section>

        {/* Danger zone */}
        <section className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-2xl p-6">
          <h2 className="font-semibold text-red-600 dark:text-red-400 mb-1">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">These actions are permanent and cannot be undone. Export your data first.</p>
          <button
            onClick={clearData}
            disabled={clearing}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm"
          >
            {clearing ? 'Clearing…' : 'Delete All Data'}
          </button>
        </section>
      </main>
    </>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
