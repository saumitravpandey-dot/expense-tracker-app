'use client';

import { useState, useEffect, useRef } from 'react';
import { CATEGORIES, TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG } from '@/lib/types';
import type { TransactionType } from '@/lib/types';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

const TODAY = () => new Date().toISOString().split('T')[0];

const TYPE_SHORTCUTS: { type: TransactionType; emoji: string }[] = [
  { type: 'expense', emoji: '💸' },
  { type: 'income', emoji: '💰' },
  { type: 'transfer', emoji: '↔️' },
];

export default function QuickAddModal({ open, onClose, onAdded }: Props) {
  const { success, error } = useToast();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [date, setDate] = useState(TODAY);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [saving, setSaving] = useState(false);
  const [hints, setHints] = useState<{ name: string; category: string; txType: string }[]>([]);
  const [showHints, setShowHints] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Load last used category from localStorage
  useEffect(() => {
    if (open) {
      setAmount('');
      setMerchant('');
      setDate(TODAY());
      setHints([]);
      try {
        const saved = localStorage.getItem('quickadd_defaults');
        if (saved) {
          const d = JSON.parse(saved);
          if (d.category) setCategory(d.category);
          if (d.txType) setTxType(d.txType);
        }
      } catch {}
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [open]);

  // Merchant autocomplete
  useEffect(() => {
    if (!merchant.trim() || merchant.length < 2) { setHints([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/expenses?merchants=1&search=${encodeURIComponent(merchant)}`);
        if (r.ok) {
          const data = await r.json();
          setHints((data.merchants ?? []).slice(0, 5));
        }
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [merchant]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          currency: 'INR',
          merchant,
          category,
          date,
          description: '',
          source: 'manual',
          transaction_type: txType,
        }),
      });
      if (!res.ok) throw new Error();
      // Save defaults
      try { localStorage.setItem('quickadd_defaults', JSON.stringify({ category, txType })); } catch {}
      success(`Added ₹${amt.toLocaleString('en-IN')} ${merchant ? `· ${merchant}` : ''}`, {
        action: { label: 'View', onClick: () => window.location.href = '/expenses' },
      });
      onAdded?.();
      onClose();
    } catch {
      error('Failed to add — try again');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const cfg = TRANSACTION_TYPE_CONFIG[txType];

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md mx-0 sm:mx-4 bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-gray-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        <div className="px-5 pb-6 pt-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">Quick Add</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Transaction type pills */}
            <div className="flex gap-2">
              {TYPE_SHORTCUTS.map(({ type, emoji }) => {
                const c = TRANSACTION_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTxType(type)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      txType === type
                        ? 'border-current text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                    }`}
                    style={txType === type ? { backgroundColor: c.color, borderColor: c.color } : {}}
                  >
                    <span>{emoji}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Amount — large and prominent */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-10 pr-4 py-4 text-3xl font-bold border-2 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 transition-colors"
                style={{ colorScheme: 'normal' }}
              />
            </div>

            {/* Merchant */}
            <div className="relative">
              <input
                type="text"
                value={merchant}
                onChange={e => { setMerchant(e.target.value); setShowHints(true); }}
                onBlur={() => setTimeout(() => setShowHints(false), 150)}
                onFocus={() => setShowHints(true)}
                placeholder="Merchant / description"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {showHints && hints.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                  {hints.map(h => (
                    <li key={h.name}>
                      <button
                        type="button"
                        onMouseDown={() => {
                          setMerchant(h.name);
                          if (h.category) setCategory(h.category);
                          if (h.txType && TRANSACTION_TYPES.includes(h.txType as TransactionType)) {
                            setTxType(h.txType as TransactionType);
                          }
                          setShowHints(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left"
                      >
                        <span className="flex-1 font-medium">{h.name}</span>
                        {h.category && <span className="text-xs text-gray-400">{h.category}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Category + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-3 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-3 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving || !amount}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: saving ? '#9ca3af' : cfg.color }}
            >
              {saving ? 'Adding…' : `Add ${cfg.label}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
