'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/trends', label: 'Trends' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/mappings', label: 'Mappings' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
  { href: '/add', label: '+ Add' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <Link href="/" className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mr-2 shrink-0">
          💰 Expenses
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                pathname === l.href
                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Command palette hint on desktop */}
          <span
            className="hidden md:inline text-xs text-gray-400 cursor-default border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded font-mono"
            title="Press ⌘K to search"
          >
            ⌘K
          </span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  return (
    <button
      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      onClick={() => {
        const isDark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
      }}
      aria-label="Toggle theme"
    >
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}
