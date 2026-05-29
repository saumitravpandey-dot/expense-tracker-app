'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ACTIONS = [
  { label: 'Add transaction', icon: '➕', href: '/add', key: 'n' },
  { label: 'Dashboard', icon: '🏠', href: '/', key: 'd' },
  { label: 'All expenses', icon: '📋', href: '/expenses', key: 'e' },
  { label: 'Import statement', icon: '📤', href: '/import', key: 'i' },
  { label: 'Trends & analytics', icon: '📊', href: '/trends', key: 't' },
  { label: 'Monthly budgets', icon: '💰', href: '/budgets' },
  { label: 'Mapping rules', icon: '🗂', href: '/mappings' },
  { label: 'Settings', icon: '⚙️', href: '/settings' },
];

interface Hit {
  id: number;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  transaction_type: string;
}

interface Props {
  onQuickAdd?: () => void;
}

export default function CommandPalette({ onQuickAdd }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global key handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inInput = ['input', 'textarea', 'select'].includes(
        (e.target as HTMLElement)?.tagName?.toLowerCase()
      );

      // Cmd+K / Ctrl+K → toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      // Escape → close
      if (e.key === 'Escape') { setOpen(false); return; }

      // ? or / when not in input → open palette
      if (!inInput && !open && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // Single-key shortcuts when not in input, palette closed
      if (!inInput && !open && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'q' && onQuickAdd) { e.preventDefault(); onQuickAdd(); return; }
        const map: Record<string, string> = { n: '/add', d: '/', e: '/expenses', i: '/import', t: '/trends' };
        if (map[e.key]) { e.preventDefault(); router.push(map[e.key]); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, open, onQuickAdd]);

  // Search
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) { setHits([]); setCursor(0); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/expenses?search=${encodeURIComponent(query)}&limit=6`);
        const d = await r.json();
        setHits(d.expenses ?? []);
        setCursor(0);
      } finally { setSearching(false); }
    }, 180);
  }, [query, open]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery(''); setHits([]); setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Arrow navigation inside palette
  useEffect(() => {
    if (!open) return;
    function navKey(e: KeyboardEvent) {
      const total = query ? hits.length : ACTIONS.length;
      if (!total) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => (c + 1) % total); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => (c - 1 + total) % total); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (query && hits[cursor]) {
          router.push(`/expenses?search=${encodeURIComponent(hits[cursor].merchant)}`);
        } else if (!query && ACTIONS[cursor]) {
          if (ACTIONS[cursor].key === 'q' && onQuickAdd) onQuickAdd();
          else router.push(ACTIONS[cursor].href);
        }
        setOpen(false);
      }
    }
    window.addEventListener('keydown', navKey);
    return () => window.removeEventListener('keydown', navKey);
  }, [open, query, hits, cursor, router, onQuickAdd]);

  if (!open) return null;

  const items = query ? hits : ACTIONS;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search expenses or jump to a page…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {searching && <span className="text-gray-300 text-xs animate-pulse">searching</span>}
          <kbd className="hidden sm:inline px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-400">esc</kbd>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto">
          {query && hits.length === 0 && !searching && (
            <p className="px-4 py-8 text-sm text-center text-gray-400">
              No expenses match &ldquo;{query}&rdquo;
            </p>
          )}

          {query && hits.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Expenses</p>
              {hits.map((h, i) => (
                <Link
                  key={h.id}
                  href={`/expenses?search=${encodeURIComponent(h.merchant)}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${cursor === i ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                  <span className="flex-1 text-sm font-medium truncate">{h.merchant || 'Expense'}</span>
                  <span className="text-xs text-gray-400 shrink-0">{h.date}</span>
                  <span className="text-sm font-mono font-semibold shrink-0">
                    {h.transaction_type === 'income' ? '+' : ''}{h.currency} {h.amount.toLocaleString('en-IN')}
                  </span>
                </Link>
              ))}
            </>
          )}

          {!query && (
            <>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Quick actions</p>
              {ACTIONS.map((a, i) => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${cursor === i ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                  <span className="w-6 text-base shrink-0">{a.icon}</span>
                  <span className="flex-1 text-sm font-medium">{a.label}</span>
                  {a.key && (
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-400">{a.key}</kbd>
                  )}
                </Link>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">↵</kbd> open</span>
          <span className="ml-auto hidden sm:inline">
            <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">⌘K</kbd> to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
