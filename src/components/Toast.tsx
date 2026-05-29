'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  toast: (item: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
  success: (message: string, opts?: { action?: ToastAction; duration?: number }) => string;
  error: (message: string) => string;
  info: (message: string) => string;
  warning: (message: string) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 10);
    setToasts(prev => [{ ...item, id }, ...prev].slice(0, 4));
    const dur = item.duration ?? (item.action ? 6000 : 3500);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, dur);
    timers.current.set(id, timer);
    return id;
  }, []);

  const success = useCallback((message: string, opts?: { action?: ToastAction; duration?: number }) =>
    toast({ type: 'success', message, ...opts }), [toast]);
  const error = useCallback((message: string) =>
    toast({ type: 'error', message, duration: 5000 }), [toast]);
  const info = useCallback((message: string) =>
    toast({ type: 'info', message }), [toast]);
  const warning = useCallback((message: string) =>
    toast({ type: 'warning', message }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, dismiss, success, error, info, warning }}>
      {children}
      {/* Fixed toast stack — above bottom nav on mobile */}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col-reverse gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map(t => (
          <ToastBubble key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' } as const;
const COLORS = {
  success: 'bg-gray-900 dark:bg-gray-800 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 dark:bg-gray-700 text-white',
  warning: 'bg-amber-500 text-white',
} as const;
const ICON_COLORS = {
  success: 'text-emerald-400',
  error: 'text-white/80',
  info: 'text-blue-300',
  warning: 'text-white',
} as const;

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${COLORS[toast.type]}`}
      style={{ animation: 'slideUp 0.2s ease-out' }}
    >
      <span className={`shrink-0 font-bold w-4 text-center ${ICON_COLORS[toast.type]}`}>
        {ICONS[toast.type]}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
          className="shrink-0 text-xs font-semibold underline text-white/80 hover:text-white whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-white/50 hover:text-white/90 text-base leading-none ml-1"
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
