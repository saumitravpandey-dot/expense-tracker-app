import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { CATEGORIES, TRANSACTION_TYPES, TRANSACTION_TYPE_CONFIG } from '@/lib/types';
import type { MappingRule, TransactionType } from '@/lib/types';

export interface ImportedTransaction {
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  description: string;
  transaction_type: TransactionType;
  checked: boolean;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a bank statement parser for Indian banks (HDFC, ICICI, SBI, Axis, Kotak, etc.).
Extract ALL debit transactions — money going OUT of the account.

Return ONLY a raw JSON array, no markdown fences, no explanation:
[{"date":"YYYY-MM-DD","amount":1234.50,"currency":"INR","merchant":"merchant name","category":"Food & Dining","description":"original line from statement","transaction_type":"expense"}]

Category must be exactly one of: ${CATEGORIES.join(', ')}
transaction_type must be exactly one of: ${TRANSACTION_TYPES.join(', ')}

Transaction type guide:
- expense: regular merchant purchases (food, shopping, services)
- transfer: own account transfers, NEFT/IMPS to self/family
- investment: MF SIP, FD creation, stock purchase, ZERODHA/GROWW
- loan_emi: home/car/personal loan EMI
- insurance: LIC premium, health/vehicle insurance
- bank_fee: service charge, annual fee, late payment fee
- cc_payment: credit card bill payment (to avoid double counting)
- cash: ATM withdrawal

Rules:
- Only include DEBITS (withdrawals, purchases, payments, UPI debits, NEFT/RTGS sent)
- SKIP: credits, salary, interest earned, refunds, opening/closing balance lines
- amount = positive number (never negative)
- date = YYYY-MM-DD (convert DD-MM-YYYY or DD/MM/YY formats)
- merchant = clean payee name (strip UPI IDs, ref numbers, branch codes)
- If currency symbol is ₹ or Rs use "INR"`;

function applyRules(
  tx: { description: string; merchant: string },
  rules: MappingRule[]
): { transaction_type: TransactionType; category: string; action: 'include' | 'exclude' } | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const targets =
      rule.apply_to === 'both'
        ? [tx.description, tx.merchant]
        : rule.apply_to === 'description'
        ? [tx.description]
        : [tx.merchant];

    const matched = targets.some(target => {
      const t = (target ?? '').toUpperCase();
      const p = rule.pattern.toUpperCase();
      switch (rule.match_type) {
        case 'contains': return t.includes(p);
        case 'startsWith': return t.startsWith(p);
        case 'equals': return t === p;
        case 'regex': try { return new RegExp(rule.pattern, 'i').test(target ?? ''); } catch { return false; }
      }
    });

    if (matched) {
      return {
        transaction_type: rule.tx_type as TransactionType,
        category: rule.category || '',
        action: rule.action as 'include' | 'exclude',
      };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, content } = body as { type: 'pdf' | 'csv'; content: string };

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const db = getDb();
    const rules = db.prepare('SELECT * FROM transaction_rules ORDER BY id ASC').all() as MappingRule[];

    let rawText = '';

    if (type === 'pdf') {
      const msg = await client.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 8096,
          system: SYSTEM,
          messages: [{
            role: 'user',
            content: [
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: 'document' as any,
                source: { type: 'base64', media_type: 'application/pdf', data: content },
              },
              { type: 'text', text: 'Extract all debit transactions from this bank statement.' },
            ],
          }],
        },
        { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } }
      );
      rawText = msg.content.find(b => b.type === 'text')?.text ?? '[]';
    } else {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Extract all debit transactions from this CSV bank statement:\n\n${content}`,
        }],
      });
      rawText = msg.content.find(b => b.type === 'text')?.text ?? '[]';
    }

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ transactions: [] });

    const raw: (ImportedTransaction & { transaction_type?: string })[] = JSON.parse(jsonMatch[0]);

    const transactions: ImportedTransaction[] = raw.map(t => {
      const aiType = (TRANSACTION_TYPES as readonly string[]).includes(t.transaction_type ?? '')
        ? (t.transaction_type as TransactionType)
        : 'expense';

      const ruleMatch = applyRules({ description: t.description, merchant: t.merchant }, rules);

      const transaction_type = ruleMatch ? ruleMatch.transaction_type : aiType;
      const category = ruleMatch?.category ? ruleMatch.category : t.category;
      const action = ruleMatch ? ruleMatch.action : 'include';

      return {
        ...t,
        transaction_type,
        category,
        checked: action === 'include' && TRANSACTION_TYPE_CONFIG[transaction_type].defaultInclude,
      };
    });

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Failed to parse statement' }, { status: 500 });
  }
}
