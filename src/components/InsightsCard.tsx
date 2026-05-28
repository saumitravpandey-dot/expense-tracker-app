'use client';

import { useState } from 'react';

export default function InsightsCard({ month }: { month: string }) {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setInsights(data.insights ?? []);
      setGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate insights');
    }
    setLoading(false);
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <span>✨</span> AI Insights
        </h2>
        {!generated && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Analyzing…' : 'Generate'}
          </button>
        )}
        {generated && (
          <button onClick={generate} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600">
            {loading ? '…' : 'Refresh'}
          </button>
        )}
      </div>

      {!generated && !loading && (
        <p className="text-sm text-gray-400 py-4 text-center">Click Generate to get AI-powered spending insights for {month}.</p>
      )}

      {loading && (
        <div className="py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400 mt-2">Analyzing your spending patterns…</p>
        </div>
      )}

      {error && <p className="text-sm text-red-500 py-2">{error}</p>}

      {!loading && insights.length > 0 && (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="shrink-0 mt-0.5 text-emerald-500">•</span>
              {insight}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
