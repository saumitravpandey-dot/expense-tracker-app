'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG } from '@/lib/types';
import type { ParsedExpense, TransactionType } from '@/lib/types';

interface MerchantHint { name: string; category: string; txType: string; }

interface Props {
  prefill?: Partial<ParsedExpense>;
  source?: 'manual' | 'ocr' | 'email' | 'text';
  onCancel?: () => void;
  defaultType?: TransactionType;
}

export default function ExpenseForm({ prefill, source = 'manual', onCancel, defaultType = 'expense' }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [txType, setTxType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState(prefill?.amount?.toString() ?? '');
  const [currency, setCurrency] = useState(prefill?.currency || 'INR');
  const [merchant, setMerchant] = useState(prefill?.merchant ?? '');
  const [category, setCategory] = useState(prefill?.category || 'Other');
  const [date, setDate] = useState(prefill?.date || today);
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [merchantHints, setMerchantHints] = useState<MerchantHint[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const merchantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/expenses?merchants=1')
      .then(r => r.json())
      .then(setMerchantHints)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (merchantRef.current && !merchantRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const suggestions = merchant.trim().length >= 1
    ? merchantHints.filter(h => h.name.toLowerCase().includes(merchant.toLowerCase()) && h.name.toLowerCase() !== merchant.toLowerCase()).slice(0, 6)
    : [];

  function selectMerchant(hint: MerchantHint) {
    setMerchant(hint.name);
    if (hint.category) setCategory(hint.category);
    if (hint.txType && (TRANSACTION_TYPES as readonly string[]).includes(hint.txType)) {
      setTxType(hint.txType as TransactionType);
    }
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !date) return setError('Amount and date are required.');
    setSaving(true);
    setError('');

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), currency, merchant, category, date, description, source, transaction_type: txType }),
    });

    if (res.ok) {
      router.push('/expenses');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Save failed');
      setSaving(false);
    }
  }

  const cfg = TRANSACTION_TYPE_CONFIG[txType];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>}

      {/* Transaction type selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Transaction Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSACTION_TYPES.map(t => {
            const c = TRANSACTION_TYPE_CONFIG[t];
            const active = txType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-left ${active ? 'text-white border-transparent' : 'border-gray-200 dark:border-gray-700 hover:opacity-80 bg-gray-50 dark:bg-gray-800'}`}
                style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
                title={c.description}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1">{cfg.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Amount *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED'].map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Merchant with autocomplete + category/type hint */}
      <div ref={merchantRef} className="relative">
        <label className="block text-sm font-medium mb-1">Merchant / Vendor</label>
        <input
          type="text"
          value={merchant}
          onChange={e => { setMerchant(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="e.g. Swiggy, Amazon, Uber"
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(h => (
              <li key={h.name}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectMerchant(h); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2"
                >
                  <span className="truncate font-medium">{h.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{h.category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date *</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional notes…"
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: cfg.color }}
        >
          {saving ? 'Saving…' : `Save ${cfg.label}`}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
