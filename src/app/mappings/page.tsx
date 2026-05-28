'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG, CATEGORIES } from '@/lib/types';
import type { MappingRule, TransactionType } from '@/lib/types';

const MATCH_TYPES = ['contains', 'startsWith', 'equals', 'regex'] as const;
const APPLY_TO = ['description', 'merchant', 'both'] as const;
const ACTIONS = ['include', 'exclude'] as const;

const blank = {
  pattern: '',
  match_type: 'contains' as const,
  apply_to: 'both' as const,
  tx_type: 'expense' as TransactionType,
  category: '',
  action: 'include' as const,
  priority: 50,
  note: '',
};

interface TestResult {
  matched: boolean;
  rule?: MappingRule;
}

export default function MappingsPage() {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importingPresets, setImportingPresets] = useState(false);
  const [presetResult, setPresetResult] = useState<{ added: number; skipped: number } | null>(null);
  const [presetsCount, setPresetsCount] = useState(0);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [filterTx, setFilterTx] = useState<string>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/rules');
    setRules(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch('/api/rules/presets').then(r => r.json()).then((d: { total: number }) => setPresetsCount(d.total));
  }, []);

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
      setRules(prev => [...prev, created].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id - b.id));
      setForm({ ...blank });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function importPresets() {
    if (!confirm(
      `Import ${presetsCount} preset mapping rules for Indian bank statements?\n\nExisting rules with the same pattern won't be duplicated.`
    )) return;
    setImportingPresets(true);
    setPresetResult(null);
    const res = await fetch('/api/rules/presets', { method: 'POST' });
    const data: { added: number; skipped: number } = await res.json();
    setPresetResult({ added: data.added, skipped: data.skipped });
    await load();
    setImportingPresets(false);
  }

  function testRule() {
    if (!testInput.trim() || rules.length === 0) return;
    const upper = testInput.toUpperCase();
    let matched: MappingRule | undefined;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const targets =
        rule.apply_to === 'both' ? [upper, upper]
        : rule.apply_to === 'description' ? [upper]
        : [upper];

      const hit = targets.some(t => {
        const p = rule.pattern.toUpperCase();
        switch (rule.match_type) {
          case 'contains': return t.includes(p);
          case 'startsWith': return t.startsWith(p);
          case 'equals': return t === p;
          case 'regex': try { return new RegExp(rule.pattern, 'i').test(testInput); } catch { return false; }
          default: return false;
        }
      });

      if (hit) { matched = rule; break; }
    }

    setTestResult({ matched: !!matched, rule: matched });
  }

  const filteredRules = rules.filter(r => {
    if (filterTx !== 'all' && r.tx_type !== filterTx) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.pattern.toLowerCase().includes(q) ||
        (r.note ?? '').toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const grouped = TRANSACTION_TYPES.reduce<Record<string, MappingRule[]>>((acc, t) => {
    acc[t] = filteredRules.filter(r => r.tx_type === t);
    return acc;
  }, {});

  function priorityBadge(p: number) {
    if (p >= 90) return { label: `P${p}`, cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' };
    if (p >= 70) return { label: `P${p}`, cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' };
    if (p >= 50) return { label: `P${p}`, cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' };
    return { label: `P${p}`, cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500' };
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Transaction Mapping Rules</h1>
            <p className="text-sm text-gray-500 mt-1">
              Rules match patterns in bank statements to classify type &amp; category.
              Higher priority wins — first matching rule is applied during import.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={importPresets}
              disabled={importingPresets}
              className="text-sm px-4 py-2 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50"
            >
              {importingPresets ? 'Importing…' : `📦 Import ${presetsCount} presets`}
            </button>
            <button
              onClick={() => setShowForm(s => !s)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl text-sm"
            >
              {showForm ? 'Cancel' : '+ Add Rule'}
            </button>
          </div>
        </div>

        {/* Preset import result banner */}
        {presetResult && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <span>
              ✅ Added <strong>{presetResult.added}</strong> preset rules
              {presetResult.skipped > 0 && ` (${presetResult.skipped} already existed — skipped)`}
            </span>
            <button onClick={() => setPresetResult(null)} className="text-gray-400 hover:text-gray-600 ml-4">✕</button>
          </div>
        )}

        {/* Add Rule Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-sm">New Mapping Rule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
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
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={form.priority}
                  onChange={e => setForm(s => ({ ...s, priority: Number(e.target.value) }))}
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
                  {ACTIONS.map(a => (
                    <option key={a} value={a}>
                      {a === 'include' ? 'Include (checked by default)' : 'Exclude (unchecked by default)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category override <span className="text-gray-400">(optional)</span></label>
                <select
                  value={form.category}
                  onChange={e => setForm(s => ({ ...s, category: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
                >
                  <option value="">— Keep AI&apos;s category —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Note <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(s => ({ ...s, note: e.target.value }))}
                  placeholder="e.g. My gym monthly subscription"
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

        {/* Test Rule */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🧪 Test a transaction description</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testInput}
              onChange={e => { setTestInput(e.target.value); setTestResult(null); }}
              onKeyDown={e => e.key === 'Enter' && testRule()}
              placeholder="Paste a raw bank statement line — e.g. NEFT/HDFC CREDIT CARD/000012345 or SWIGGY ORDER"
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <button
              onClick={testRule}
              disabled={!testInput.trim()}
              className="px-4 py-2 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              Test
            </button>
          </div>
          {testResult && (
            <div className={`mt-3 px-4 py-3 rounded-lg text-sm ${
              testResult.matched
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
                : 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800'
            }`}>
              {testResult.matched && testResult.rule ? (
                <div className="space-y-1">
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    ✅ Matched rule #{testResult.rule.id} (Priority {testResult.rule.priority ?? 0})
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                    &quot;{testResult.rule.pattern}&quot; {testResult.rule.match_type} in {testResult.rule.apply_to}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    → Type: <strong>{TRANSACTION_TYPE_CONFIG[testResult.rule.tx_type as TransactionType]?.label}</strong>
                    {testResult.rule.category && <span className="ml-2">· Category: <strong>{testResult.rule.category}</strong></span>}
                    <span className={`ml-2 font-medium ${testResult.rule.action === 'include' ? 'text-emerald-600' : 'text-red-500'}`}>
                      ({testResult.rule.action})
                    </span>
                  </p>
                  {testResult.rule.note && (
                    <p className="text-xs text-gray-400 italic">{testResult.rule.note}</p>
                  )}
                </div>
              ) : (
                <p className="text-yellow-800 dark:text-yellow-300">
                  ⚠ No rule matched — AI will classify this transaction automatically.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pattern or note…"
            className="flex-1 min-w-[160px] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={filterTx}
            onChange={e => setFilterTx(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
          >
            <option value="all">All types ({rules.length})</option>
            {TRANSACTION_TYPES
              .filter(t => rules.some(r => r.tx_type === t))
              .map(t => (
                <option key={t} value={t}>
                  {TRANSACTION_TYPE_CONFIG[t].label} ({rules.filter(r => r.tx_type === t).length})
                </option>
              ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {rules.length === 0
              ? <>No rules yet. <button onClick={importPresets} className="text-emerald-600 underline">Import the preset pack</button> or add one above.</>
              : 'No rules match the current filter.'
            }
          </div>
        ) : (
          <div className="space-y-6">
            {TRANSACTION_TYPES.filter(t => grouped[t].length > 0).map(txType => {
              const cfg = TRANSACTION_TYPE_CONFIG[txType];
              const txRules = grouped[txType];
              return (
                <div key={txType}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                    <h2 className="font-semibold text-sm" style={{ color: cfg.color }}>{cfg.label}</h2>
                    <span className="text-xs text-gray-400">— {cfg.description}</span>
                    <span className="text-xs text-gray-400 ml-auto">{txRules.length} rule{txRules.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Pri</th>
                          <th className="px-3 py-2.5 text-left">Pattern</th>
                          <th className="px-3 py-2.5 text-left">Match</th>
                          <th className="px-3 py-2.5 text-left">In</th>
                          <th className="px-3 py-2.5 text-left">Action</th>
                          <th className="px-3 py-2.5 text-left">Category</th>
                          <th className="px-3 py-2.5 text-left hidden lg:table-cell">Note</th>
                          <th className="px-3 py-2.5 text-center">On</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {txRules.map(rule => {
                          const pb = priorityBadge(rule.priority ?? 0);
                          return (
                            <tr
                              key={rule.id}
                              className={`transition-opacity ${!rule.enabled ? 'opacity-40' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/40`}
                            >
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${pb.cls}`}>
                                  {pb.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs font-medium max-w-[180px]">
                                <span className="truncate block" title={rule.pattern}>{rule.pattern}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-500">{rule.match_type}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500">{rule.apply_to}</td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  rule.action === 'include'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                }`}>
                                  {rule.action}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[140px]">
                                <span className="truncate block" title={rule.category}>{rule.category || <span className="italic">—</span>}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[200px] hidden lg:table-cell" title={rule.note}>
                                <span className="truncate block">{rule.note || '—'}</span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
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
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  onClick={() => deleteRule(rule.id)}
                                  disabled={deletingId === rule.id}
                                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                                >
                                  {deletingId === rule.id ? '…' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-8 leading-relaxed">
          Rules sorted by priority (highest first) — first match wins.
          Priority guide: <strong>100</strong> CC payments · <strong>90</strong> own transfers · <strong>85</strong> investments ·
          <strong> 80</strong> insurance · <strong>75</strong> loan EMIs · <strong>70</strong> bank fees · <strong>65</strong> ATM/cash ·
          <strong> 50</strong> merchant categories (food, shopping, etc.)
        </p>
      </main>
    </>
  );
}
