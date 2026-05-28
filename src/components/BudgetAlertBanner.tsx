'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Alert {
  category: string;
  spent: number;
  budget: number;
  currency: string;
}

export default function BudgetAlertBanner({ alerts, month }: { alerts: Alert[]; month: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const key = `budget-alert-dismissed-${month}`;
    setDismissed(sessionStorage.getItem(key) === '1');
  }, [month]);

  if (dismissed || alerts.length === 0) return null;

  function dismiss() {
    sessionStorage.setItem(`budget-alert-dismissed-${month}`, '1');
    setDismissed(true);
  }

  return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4 flex items-start gap-3">
      <span className="text-red-500 text-lg shrink-0">⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
          {alerts.length} categor{alerts.length === 1 ? 'y' : 'ies'} over budget this month
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {alerts.map(a => (
            <span key={a.category} className="text-xs text-red-600 dark:text-red-400">
              <strong>{a.category}</strong>: {a.currency} {Math.round(a.spent).toLocaleString('en-IN')} / {Math.round(a.budget).toLocaleString('en-IN')} ({Math.round((a.spent / a.budget) * 100)}%)
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/budgets" className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline">
          Review →
        </Link>
        <button onClick={dismiss} className="text-red-400 hover:text-red-600 text-lg leading-none" aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}
