'use client';

import { useState } from 'react';
import Nav from '@/components/Nav';
import AutoDetect from '@/components/AutoDetect';
import ExpenseForm from '@/components/ExpenseForm';
import type { ParsedExpense } from '@/lib/types';

type Mode = 'auto' | 'manual';

export default function AddPage() {
  const [mode, setMode] = useState<Mode>('auto');
  const [prefill, setPrefill] = useState<Partial<ParsedExpense> | null>(null);
  const [source, setSource] = useState<'ocr' | 'email' | 'text' | 'manual'>('manual');

  function handleParsed(data: Partial<ParsedExpense>, src: 'ocr' | 'email' | 'text') {
    setPrefill(data);
    setSource(src);
    setMode('manual');
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Add Transaction</h1>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
          <button
            onClick={() => { setMode('auto'); setPrefill(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'auto'
                ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Auto Detect
          </button>
          <button
            onClick={() => { setMode('manual'); setPrefill(null); setSource('manual'); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'manual'
                ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Manual Entry
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          {mode === 'auto' ? (
            <AutoDetect onParsed={handleParsed} />
          ) : (
            <>
              {prefill && (
                <div className="mb-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
                  ✓ Fields pre-filled from auto-detect — review and save.
                </div>
              )}
              <ExpenseForm
                prefill={prefill ?? undefined}
                source={source}
                onCancel={() => { setMode('auto'); setPrefill(null); }}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}
