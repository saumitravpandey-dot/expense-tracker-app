'use client';

import { useState, useRef } from 'react';
import type { ParsedExpense } from '@/lib/types';

type Tab = 'image' | 'email' | 'text';

interface Props {
  onParsed: (data: Partial<ParsedExpense>, source: 'ocr' | 'email' | 'text') => void;
}

export default function AutoDetect({ onParsed }: Props) {
  const [tab, setTab] = useState<Tab>('image');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function parse(type: Tab, content: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: Partial<ParsedExpense> = await res.json();
      onParsed(data, type === 'image' ? 'ocr' : type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed');
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'image', label: 'Image / Receipt', icon: '📷' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'text', label: 'Paste Text', icon: '📋' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); setPreview(null); setTextInput(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'image' && (
        <div className="space-y-3">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Receipt preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm text-gray-500">Click to upload a receipt, invoice, or screenshot</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP supported</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => cameraRef.current?.click()}
              className="md:hidden text-sm px-4 py-2 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              📷 Use Camera
            </button>
          </div>
          {preview && (
            <button
              onClick={() => parse('image', preview!)}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Extracting…' : 'Extract Expense from Image'}
            </button>
          )}
        </div>
      )}

      {(tab === 'email' || tab === 'text') && (
        <div className="space-y-3">
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            rows={8}
            placeholder={
              tab === 'email'
                ? 'Paste the email receipt content here…\n\nFrom: orders@amazon.in\nSubject: Your order has been placed\nOrder Total: ₹1,299…'
                : 'Paste any text — bank SMS, notification, transaction details…\n\ne.g. "Your A/c XX1234 is debited INR 350 on 28-05-26 for UPI txn at Swiggy"'
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono text-sm"
          />
          <button
            onClick={() => parse(tab, textInput)}
            disabled={loading || !textInput.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Parsing…' : 'Auto-detect Expense'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
