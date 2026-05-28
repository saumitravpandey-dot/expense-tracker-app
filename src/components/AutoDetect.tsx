'use client';

import { useState, useRef, useEffect } from 'react';
import type { ParsedExpense } from '@/lib/types';

type Tab = 'image' | 'email' | 'text' | 'voice';

interface Props {
  onParsed: (data: Partial<ParsedExpense>, source: 'ocr' | 'email' | 'text') => void;
}

export default function AutoDetect({ onParsed }: Props) {
  const [tab, setTab] = useState<Tab>('image');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [hasSpeechAPI, setHasSpeechAPI] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setHasSpeechAPI(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  async function parse(type: Exclude<Tab, 'voice'>, content: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type === 'image' ? 'image' : 'text', content }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: Partial<ParsedExpense> = await res.json();
      onParsed(data, type === 'image' ? 'ocr' : type === 'email' ? 'email' : 'text');
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
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join('');
      setVoiceTranscript(transcript);
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = () => { setVoiceListening(false); setError('Microphone error — allow mic access and try again.'); };
    recognitionRef.current = recognition;
    recognition.start();
    setVoiceListening(true);
    setVoiceTranscript('');
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'image', label: 'Image', icon: '📷' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'text', label: 'Text', icon: '📋' },
    ...(hasSpeechAPI ? [{ id: 'voice' as Tab, label: 'Voice', icon: '🎤' }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); setPreview(null); setTextInput(''); setVoiceTranscript(''); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
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
          <div className="flex gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="md:hidden text-sm px-4 py-2 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              📷 Use Camera
            </button>
            {preview && (
              <button onClick={() => { setPreview(null); }} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                ✕ Clear
              </button>
            )}
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

      {tab === 'voice' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Say the expense naturally — e.g. <em>&ldquo;Swiggy 350 rupees food, today&rdquo;</em> or <em>&ldquo;HDFC credit card bill 5000&rdquo;</em>
          </p>
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={voiceListening ? stopVoice : startVoice}
              className={`w-20 h-20 rounded-full text-white text-3xl flex items-center justify-center transition-all shadow-lg ${
                voiceListening
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {voiceListening ? '⏹' : '🎤'}
            </button>
            <p className="text-sm text-gray-500">
              {voiceListening ? 'Listening… click to stop' : 'Click to start speaking'}
            </p>
          </div>
          {voiceTranscript && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Heard:</p>
              <p className="text-sm font-medium">{voiceTranscript}</p>
            </div>
          )}
          {voiceTranscript && !voiceListening && (
            <button
              onClick={() => parse('text', voiceTranscript)}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Parsing…' : 'Parse This'}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
