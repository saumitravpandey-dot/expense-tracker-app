import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES } from '@/lib/types';
import type { ParsedExpense } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an expense extraction assistant. Given text or image content, extract expense details and return ONLY valid JSON with these fields:
{
  "amount": number or null,
  "currency": "INR" (default) or detected currency code,
  "merchant": "merchant/vendor name or empty string",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "date": "YYYY-MM-DD or empty string if unknown",
  "description": "brief description of the expense"
}
If multiple expenses exist, return only the primary/largest one. Never return markdown, only raw JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, content } = body as { type: 'text' | 'email' | 'image'; content: string };

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  try {
    let parsed: ParsedExpense;

    if (type === 'image') {
      // content is base64 data URL: "data:image/jpeg;base64,..."
      const [header, b64] = content.split(',');
      const mediaType = header.split(':')[1].split(';')[0] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: 'Extract the expense details from this receipt/screenshot.' },
          ],
        }],
      });

      const text = msg.content.find(b => b.type === 'text')?.text ?? '{}';
      parsed = JSON.parse(text);
    } else {
      const label = type === 'email' ? 'email receipt' : 'text/clipboard content';
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Extract the expense from this ${label}:\n\n${content}`,
        }],
      });

      const text = msg.content.find(b => b.type === 'text')?.text ?? '{}';
      parsed = JSON.parse(text);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Parse error:', err);
    return NextResponse.json({ error: 'Failed to parse expense' }, { status: 500 });
  }
}
