'use client';

import { useRouter } from 'next/navigation';

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const isCurrentMonth = month === currentYM();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.push(`/?month=${prevMonth(month)}`)}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[130px] text-center">
        {monthLabel(month)}
      </span>
      <button
        onClick={() => router.push(isCurrentMonth ? '/' : `/?month=${nextMonth(month)}`)}
        disabled={isCurrentMonth}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        ›
      </button>
      {!isCurrentMonth && (
        <button
          onClick={() => router.push('/')}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline ml-1"
        >
          Today
        </button>
      )}
    </div>
  );
}
