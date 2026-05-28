'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG } from '@/lib/types';
import type { MappingRule, TransactionType } from '@/lib/types';

const MATCH_TYPES = ['contains', 'startsWith', 'equals', 'regex'] as const;
const APPLY_TO = ['description', 'merchant', 'both'] as const;
const ACTIONS = ['include', 'exclude'] as const;

const blank = {
  pattern: '',
  match_type: 'contains' as const,
  apply_to: 'description' as const,
  tx_type: 'expense' as TransactionType,
  category: '',
  action: 'include' as const,
};

export default function MappingsPage() {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/rules');
    setRules(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleEnabled(rule: MappingRule) {
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: rule.enabled ? 0 : 1 }),
    });
    if (res.ok) {
      const updated: MappingRule = await res.json();
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    }
  }

  async function deleteRule(id: number) {
    if (!confirm('Delete this rule?')) return;
    setDeletingId(id);
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
  }

  async function createRule() {
    if (!form.pattern.trim()) return;
    setSaving(true);
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created: MappingRule = await res.json();
      setRules(prev => [...prev, created]);
      setForm({ ...blank });
      setShowForm(false);
    }
    setSaving(false);
  }

  const grouped = TRANSACTION_TYPES.reduce<Record<string, MappingRule[]>>((acc, t) => {
    acc[t] = rules.filter(r => r.tx_type === t);
    return acc;
  }, {});

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Transaction Mapping Rules</h1>
            <p className="text-sm text-gray-500 mt-1">
              Rules match patterns in your bank statements to classify transaction types and categories.
              Applied automatically during import — first matching rule wins.
            </p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl text-sm"
          >
            {showForm ? 'Cancel' : '+ Add Rule'}
          </button>
        </div>

        {/* Add Rule Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-sm">New Mapping Rule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pattern *</label>
                <input
                  type="text"
                  value={form.pattern}
                  onChange={e => setForm(s => ({ ...s, pattern: e.target.value }))}
                  placeholder="e.g. CREDIT CARD, ZERODHA, /SIP/"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Match type</label>
                <select
                  value={form.match_type}
                  onChange={e => setForm(s => ({ ...s, match_type: e.target.value as typeof blank.match_type }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
                >
                  {MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Apply to</label>
                <select
                  value={form.apply_to}
                  onChange={e => setForm(s => ({ ...s, apply_to: e.target.value as typeof blank.apply_to }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
                >
                  {APPLY_TO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Transaction type</label>
                <select
                  value={form.tx_type}
                  onChange={e => setForm(s => ({ ...s, tx_type: e.target.value as TransactionType }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
                >
                  {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{TRANSACTION_TYPE_CONFIG[t].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Action</label>
                <select
                  value={form.action}
                  onChange={e => setForm(s => ({ ...s, action: e.target.value as typeof blank.action }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
                >
                  {ACTIONS.map(a => <option key={a} value={a}>{a === 'include' ? 'Include (checked by default)' : 'Exclude (unchecked by default)'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Override category <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm(s => ({ ...s, category: e.target.value }))}
                  placeholder="Leave blank to keep AI's category"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={createRule}
                disabled={saving || !form.pattern.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-sm"
              >
                {saving ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No rules yet. Add one above.</div>
        ) : (
          <div className="space-y-6">
            {TRANSACTION_TYPES.filter(t => grouped[t].length > 0).map(txType => {
              const cfg = TRANSACTION_TYPE_CONFIG[txType];
              return (
                <div key={txType}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <h2 className="font-semibold text-sm" style={{ color: cfg.color }}>{cfg.label}</h2>
                    <span className="text-xs text-gray-400">— {cfg.description}</span>
                  </div>

                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Pattern</th>
                          <th className="px-4 py-2.5 text-left">Match</th>
                          <th className="px-4 py-2.5 text-left">Apply to</th>
                          <th className="px-4 py-2.5 text-left">Action</th>
                          <th className="px-4 py-2.5 text-left">Category override</th>
                          <th className="px-4 py-2.5 text-center">On</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {grouped[txType].map(rule => (
                          <tr
                            key={rule.id}
                            className={`transition-opacity ${!rule.enabled ? 'opacity-40' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/40`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs font-medium">{rule.pattern}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{rule.match_type}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{rule.apply_to}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                rule.action === 'include'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                              }`}>
                                {rule.action}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400">{rule.category || <span className="italic">—</span>}</td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => toggleEnabled(rule)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  rule.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  rule.enabled ? 'translate-x-4' : 'translate-x-1'
                                }`} />
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => deleteRule(rule.id)}
                                disabled={deletingId === rule.id}
                                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                              >
                                {deletingId === rule.id ? '…' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-8">
          Rules are evaluated in order — first match wins. Changes take effect on the next import.
          To re-classify existing expenses, re-import or edit them manually.
        </p>
      </main>
    </>
  );
}
