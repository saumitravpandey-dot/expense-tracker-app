import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { month } = await req.json() as { month: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    }

    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, '0')}`;

    const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const prevStart = `${prevMonth}-01`;
    const prevLastDay = new Date(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 0).getDate();
    const prevEnd = `${prevMonth}-${String(prevLastDay).padStart(2, '0')}`;

    const db = getDb();

    const curByCategory = db.prepare(
      `SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND date <= ? AND transaction_type != 'income' GROUP BY category ORDER BY total DESC`
    ).all(start, end) as { category: string; total: number; count: number }[];

    const prevByCategory = db.prepare(
      `SELECT category, SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type != 'income' GROUP BY category`
    ).all(prevStart, prevEnd) as { category: string; total: number }[];

    const curTotal = curByCategory.reduce((s, c) => s + c.total, 0);
    const prevTotal = prevByCategory.reduce((s, c) => s + c.total, 0);
    const currency = (db.prepare(`SELECT currency FROM expenses ORDER BY id DESC LIMIT 1`).get() as { currency: string } | undefined)?.currency ?? 'INR';
    const income = (db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ? AND transaction_type = 'income'`).get(start, end) as { total: number }).total;

    const curMap = Object.fromEntries(curByCategory.map(c => [c.category, c.total]));
    const prevMap = Object.fromEntries(prevByCategory.map(c => [c.category, c.total]));

    const context = `
Month: ${month}
Currency: ${currency}
Total Expenses: ${Math.round(curTotal).toLocaleString('en-IN')} (prev month: ${Math.round(prevTotal).toLocaleString('en-IN')})
Income this month: ${Math.round(income).toLocaleString('en-IN')}
Net savings: ${Math.round(income - curTotal).toLocaleString('en-IN')}

Spending by category (this month vs last month):
${curByCategory.map(c => {
  const prev = prevMap[c.category] ?? 0;
  const diff = c.total - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
  return `  ${c.category}: ${Math.round(c.total).toLocaleString('en-IN')} (${diff > 0 ? '+' : ''}${pct}% vs last month, ${c.count} txns)`;
}).join('\n')}

Categories with no spend this month but had spend last month:
${prevByCategory.filter(c => !curMap[c.category]).map(c => `  ${c.category}: 0 (was ${Math.round(c.total).toLocaleString('en-IN')})`).join('\n') || '  None'}
`;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a personal finance advisor. Based on this spending data, provide exactly 4 concise insights (1-2 sentences each). Be specific with numbers. Focus on: notable changes vs last month, potential savings opportunities, and positive observations. Format as a JSON array of strings: ["insight1","insight2","insight3","insight4"]\n\n${context}`,
      }],
    });

    const text = msg.content.find(b => b.type === 'text')?.text ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    const insights: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ insights, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Insights error:', err);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
