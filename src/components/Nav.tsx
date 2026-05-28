'use client';

import { useState } from 'react';
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
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* Desktop row */}
      <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <Link href="/" className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mr-2 shrink-0">
          💰 Expenses
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
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

        {/* Mobile: show only key links */}
        <div className="flex md:hidden items-center gap-1 overflow-x-auto">
          {links.filter(l => ['/', '/expenses', '/add'].includes(l.href)).map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
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
          <ThemeToggle />
          {/* Hamburger for mobile */}
          <button
            onClick={() => setOpen(s => !s)}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label="Menu"
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 grid grid-cols-2 gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                pathname === l.href
                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
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
