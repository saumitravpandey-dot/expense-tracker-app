'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { CATEGORIES, TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG } from '@/lib/types';
import type { TransactionType } from '@/lib/types';
import type { ImportedTransaction } from '@/app/api/import/route';

type Step = 'upload' | 'processing' | 'review' | 'done';

interface ReviewRow extends ImportedTransaction {
  checked: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function TypeBadge({ type }: { type: TransactionType }) {
  const cfg = TRANSACTION_TYPE_CONFIG[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}44` }}
    >
      {cfg.label}
    </span>
  );
}

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [includeCredits, setIncludeCredits] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setStep('processing');
    setError('');
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const type: 'pdf' | 'csv' = isPdf ? 'pdf' : 'csv';
      const content = isPdf ? await fileToBase64(file) : await file.text();

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, includeCredits }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Parse failed');

      const transactions: ImportedTransaction[] = data.transactions ?? [];
      if (transactions.length === 0) {
        setError('No transactions found. Make sure this is a bank statement with debit entries.');
        setStep('upload');
        return;
      }

      setRows(transactions.map(t => ({ ...t })));
      setTypeFilter('all');
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process file');
      setStep('upload');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAll(checked: boolean) {
    setRows(prev => prev.map(r =>
      typeFilter === 'all' || r.transaction_type === typeFilter ? { ...r, checked } : r
    ));
  }

  function toggleRow(i: number) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r));
  }

  function updateField(i: number, field: keyof ReviewRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  async function handleImport() {
    const selected = rows.filter(r => r.checked);
    if (!selected.length) return;
    setSaving(true);
    let count = 0;
    for (const row of selected) {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(row.amount),
          currency: row.currency || 'INR',
          merchant: row.merchant,
          category: row.category,
          date: row.date,
          description: row.description,
          source: 'import',
          transaction_type: row.transaction_type,
        }),
      });
      if (res.ok) count++;
    }
    setImportedCount(count);
    setSaving(false);
    setStep('done');
  }

  const visibleRows = typeFilter === 'all' ? rows : rows.filter(r => r.transaction_type === typeFilter);
  const checkedCount = rows.filter(r => r.checked).length;
  const checkedTotal = rows.filter(r => r.checked).reduce((s, r) => s + Number(r.amount), 0);

  const typeCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.transaction_type] = (acc[r.transaction_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Import Bank Statement</h1>
          <p className="text-sm text-gray-500">Upload a PDF or CSV — AI extracts and categorises every debit automatically.</p>
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800/30'
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg font-semibold mb-1">Drop your bank statement here</p>
              <p className="text-sm text-gray-500 mb-5">PDF or CSV · HDFC, ICICI, SBI, Axis, Kotak, Yes Bank &amp; more</p>
              <span className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm">
                Choose File
              </span>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.csv,text/csv,application/pdf" className="hidden" onChange={handleFileChange} />

            {/* Include credits toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setIncludeCredits(s => !s)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${includeCredits ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${includeCredits ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Also capture income/credits (salary, UPI received)
              </span>
            </label>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 text-sm space-y-1.5 text-gray-500">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">How to download your statement</p>
              <p>🏦 <strong>HDFC</strong> — Net Banking → My Accounts → Download Statement</p>
              <p>🏦 <strong>ICICI</strong> — iMobile / Net Banking → Accounts → e-Statement</p>
              <p>🏦 <strong>SBI</strong> — OnlineSBI → e-Services → e-Statement</p>
              <p>🏦 <strong>Axis / Kotak</strong> — Net Banking → Accounts → Statement Download</p>
              <p className="pt-2 text-xs">Your file is processed locally — never uploaded to any third-party server.</p>
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {step === 'processing' && (
          <div className="text-center py-28">
            <div className="text-6xl mb-6 animate-pulse">🔍</div>
            <p className="text-xl font-semibold mb-2">Analysing your statement…</p>
            <p className="text-sm text-gray-500">Claude is reading every line and classifying each transaction.<br />This takes 15–45 seconds depending on statement length.</p>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-lg">{rows.length} transactions extracted</p>
                <p className="text-sm text-gray-500">
                  {checkedCount} selected · {rows[0]?.currency ?? 'INR'} {checkedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => toggleAll(true)} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Select All</button>
                <button onClick={() => toggleAll(false)} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Deselect All</button>
                <button onClick={() => { setStep('upload'); setRows([]); }} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">← Re-upload</button>
              </div>
            </div>

            {/* Type filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                All ({rows.length})
              </button>
              {TRANSACTION_TYPES.filter(t => typeCounts[t]).map(t => {
                const cfg = TRANSACTION_TYPE_CONFIG[t];
                const active = typeFilter === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? 'text-white border-transparent' : 'hover:opacity-80'}`}
                    style={active
                      ? { backgroundColor: cfg.color, borderColor: cfg.color }
                      : { backgroundColor: cfg.color + '18', color: cfg.color, borderColor: cfg.color + '44' }
                    }
                  >
                    {cfg.label} ({typeCounts[t]})
                  </button>
                );
              })}
            </div>

            {typeFilter !== 'all' && (
              <p className="text-xs text-gray-400 -mt-1">
                {TRANSACTION_TYPE_CONFIG[typeFilter].description} —{' '}
                {TRANSACTION_TYPE_CONFIG[typeFilter].defaultInclude ? 'included by default' : 'excluded by default (unchecked)'}
              </p>
            )}

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox"
                        checked={visibleRows.length > 0 && visibleRows.every(r => r.checked)}
                        onChange={e => toggleAll(e.target.checked)}
                        className="rounded" />
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Date</th>
                    <th className="px-3 py-3 text-left">Merchant</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Category</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visibleRows.map((row, vi) => {
                    const i = rows.indexOf(row);
                    return (
                      <tr key={i} className={`transition-opacity ${!row.checked ? 'opacity-35' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/40`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={row.checked} onChange={() => toggleRow(i)} className="rounded" />
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{row.date}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={row.merchant}
                            onChange={e => updateField(i, 'merchant', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-emerald-500 focus:outline-none px-0 py-0.5 font-medium"
                          />
                          {row.description && row.description !== row.merchant && (
                            <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{row.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={row.transaction_type}
                            onChange={e => updateField(i, 'transaction_type', e.target.value)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {TRANSACTION_TYPES.map(t => (
                              <option key={t} value={t}>{TRANSACTION_TYPE_CONFIG[t].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={row.category}
                            onChange={e => updateField(i, 'category', e.target.value)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-sm">
                          {row.currency} {Number(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
              <p className="text-sm text-gray-400">Edit merchant, type, or category above. Unchecked rows are excluded.</p>
              <button
                onClick={handleImport}
                disabled={saving || checkedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-7 py-2.5 rounded-xl transition-colors"
              >
                {saving ? 'Importing…' : `Import ${checkedCount} Transaction${checkedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="text-center py-24">
            <div className="text-7xl mb-6">✅</div>
            <p className="text-2xl font-bold mb-2">{importedCount} transactions imported!</p>
            <p className="text-sm text-gray-500 mb-8">Your dashboard is now updated with the imported data.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => router.push('/')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl">
                View Dashboard
              </button>
              <button
                onClick={() => { setStep('upload'); setRows([]); setError(''); setImportedCount(0); }}
                className="border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-2.5 rounded-xl"
              >
                Import Another
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
