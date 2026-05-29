'use client';

import { useState, useCallback } from 'react';
import { ToastProvider } from './Toast';
import CommandPalette from './CommandPalette';
import QuickAddModal from './QuickAddModal';
import BottomNav from './BottomNav';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);

  return (
    <ToastProvider>
      <CommandPalette onQuickAdd={openQuickAdd} />
      <QuickAddModal open={quickAddOpen} onClose={closeQuickAdd} />
      <BottomNav onAdd={openQuickAdd} />
      {children}
    </ToastProvider>
  );
}
