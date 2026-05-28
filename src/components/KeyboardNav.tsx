'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUTS = [
  { key: 'n', description: 'New transaction', href: '/add' },
  { key: 'd', description: 'Go to Dashboard', href: '/' },
  { key: 'e', description: 'Go to Expenses', href: '/expenses' },
  { key: 'i', description: 'Import statement', href: '/import' },
  { key: 't', description: 'Trends', href: '/trends' },
  { key: '?', description: 'Show shortcuts', href: null },
];

export default function KeyboardNav() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't fire when user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        setShowHelp(s => !s);
        return;
      }
      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }
      const shortcut = SHORTCUTS.find(s => s.key === e.key && s.href);
      if (shortcut?.href) {
        e.preventDefault();
        router.push(shortcut.href);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-80 border border-gray-200 dark:border-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Keyboard Shortcuts</h2>
          <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{s.description}</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono font-semibold">{s.key}</kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">Press <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">Esc</kbd> or <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">?</kbd> to close</p>
      </div>
    </div>
  );
}
