export interface Expense {
  id: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  date: string; // YYYY-MM-DD
  description: string;
  source: 'manual' | 'ocr' | 'email' | 'text' | 'import';
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

export const TRANSACTION_TYPES = [
  'expense',
  'income',
  'transfer',
  'investment',
  'loan_emi',
  'insurance',
  'bank_fee',
  'cc_payment',
  'cash',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, {
  label: string;
  color: string;
  defaultInclude: boolean;
  description: string;
}> = {
  expense:    { label: 'Expense',     color: '#22c55e', defaultInclude: true,  description: 'Regular merchant spending' },
  income:     { label: 'Income',      color: '#10b981', defaultInclude: true,  description: 'Salary, freelance, interest earned' },
  transfer:   { label: 'Transfer',    color: '#3b82f6', defaultInclude: false, description: 'Own account or family transfers' },
  investment: { label: 'Investment',  color: '#a855f7', defaultInclude: false, description: 'MF SIP, FD, stocks, bonds' },
  loan_emi:   { label: 'Loan EMI',    color: '#f97316', defaultInclude: true,  description: 'Home, car, personal loan EMI' },
  insurance:  { label: 'Insurance',   color: '#06b6d4', defaultInclude: true,  description: 'LIC, health, vehicle insurance' },
  bank_fee:   { label: 'Bank Fee',    color: '#ef4444', defaultInclude: true,  description: 'Service charges, late fees' },
  cc_payment: { label: 'CC Payment',  color: '#eab308', defaultInclude: false, description: 'Credit card bill settlement — skip to avoid double counting' },
  cash:       { label: 'Cash (ATM)',  color: '#6b7280', defaultInclude: true,  description: 'ATM withdrawals' },
};

export interface MappingRule {
  id: number;
  pattern: string;
  match_type: 'contains' | 'startsWith' | 'equals' | 'regex';
  apply_to: 'description' | 'merchant' | 'both';
  tx_type: TransactionType;
  category: string;
  action: 'include' | 'exclude';
  enabled: number;
  priority: number;
  note: string;
  amount_min: number | null;
  amount_max: number | null;
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
