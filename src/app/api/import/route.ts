import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES } from '@/lib/types';

export interface ImportedTransaction {
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  description: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a bank statement parser for Indian banks (HDFC, ICICI, SBI, Axis, Kotak, etc.).
Extract ALL debit/expense transactions — money going OUT of the account.

Return ONLY a raw JSON array, no markdown fences, no explanation:
[{"date":"YYYY-MM-DD","amount":1234.50,"currency":"INR","merchant":"merchant name","category":"Food & Dining","description":"original line from statement"}]

Category must be exactly one of: ${CATEGORIES.join(', ')}

Rules:
- Only include DEBITS (withdrawals, purchases, payments, UPI debits, NEFT/RTGS sent)
- SKIP: credits, salary, interest earned, refunds, opening/closing balance lines, internal transfers to own accounts
- amount = positive number (never negative)
- date = YYYY-MM-DD (convert DD-MM-YYYY or DD/MM/YY formats)
- merchant = clean payee name (strip UPI IDs, ref numbers, branch codes)
- If currency symbol is ₹ or Rs use "INR"`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, content } = body as { type: 'pdf' | 'csv'; content: string };

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    let rawText = '';

    if (type === 'pdf') {
      // Send PDF directly to Claude via the beta documents API
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
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: content,
                },
              },
              { type: 'text', text: 'Extract all debit/expense transactions from this bank statement.' },
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

    const transactions: ImportedTransaction[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Failed to parse statement' }, { status: 500 });
  }
}
