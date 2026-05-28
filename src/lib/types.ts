export interface Expense {
  id: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  date: string; // YYYY-MM-DD
  description: string;
  source: 'manual' | 'ocr' | 'email' | 'text';
  created_at: string;
}

export interface ParsedExpense {
  amount: number | null;
  currency: string;
  merchant: string;
  category: string;
  date: string;
  description: string;
}

export const CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Medical',
  'Travel',
  'Education',
  'Personal Care',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f97316',
  'Transport': '#3b82f6',
  'Shopping': '#a855f7',
  'Entertainment': '#ec4899',
  'Bills & Utilities': '#ef4444',
  'Health & Medical': '#22c55e',
  'Travel': '#06b6d4',
  'Education': '#eab308',
  'Personal Care': '#f472b6',
  'Other': '#6b7280',
};
