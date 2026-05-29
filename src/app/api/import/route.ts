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
  duplicate?: boolean;
  bank?: string;
}

export type StatementType = 'bank' | 'cc';
export type BankHint =
  | 'hdfc' | 'sbi' | 'icici' | 'axis' | 'kotak'
  | 'indusind' | 'idfc' | 'amex' | 'rbl' | 'yes' | 'auto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = `
Return ONLY a raw JSON array — no markdown fences, no explanation, no preamble:
[{"date":"YYYY-MM-DD","amount":1234.50,"currency":"INR","merchant":"Clean Name","category":"Food & Dining","description":"original raw text","transaction_type":"expense"}]

Strict rules:
- amount: always a POSITIVE number (never negative)
- date: YYYY-MM-DD (convert DD/MM/YY, DD-MM-YYYY, DD MMM YYYY, MM/DD/YY etc.)
- merchant: clean recognizable brand name (see merchant cleaning rules below)
- description: preserve the original raw text from the statement exactly
- category: MUST be one of: ${CATEGORIES.join(', ')}
- transaction_type: MUST be one of: ${TRANSACTION_TYPES.join(', ')}
`;

const TRANSACTION_TYPE_GUIDE = `
transaction_type meanings:
- expense: regular purchases at merchants (food, shopping, travel, entertainment, subscriptions)
- income: salary, freelance pay, UPI received, interest earned, dividends, rental income
- transfer: own account transfers, NEFT/IMPS/RTGS to self or family, wallet top-ups
- investment: MF/SIP, FD creation, stocks (Zerodha/Groww/Upstox), bonds, PPF
- loan_emi: home/car/personal/gold loan EMI, credit card EMI conversion
- insurance: LIC premium, health/vehicle/term insurance
- bank_fee: annual fee, late payment fee, finance charges, interest charged, processing fee, forex markup, fuel surcharge, GST on charges, locker charges, SMS charges
- cc_payment: credit card bill payment (debit from bank account to pay CC bill) — exclude these
- cash: ATM withdrawal, cash advance on credit card
`;

const CC_MERCHANT_CLEANING = `
Merchant name cleaning for credit card statements:
- Remove leading prefixes: "POS ", "ONLINE ", "IWB ", "SI ", "UPI/"
- Remove trailing city/country: " MUMBAI", " DELHI", " BANGALORE", " INDIA", " IND", " IN"
- Remove trailing legal suffixes: " PVT LTD", " TECHNOLOGIES", " MEDIA", " PAYMENTS"
- Remove reference codes: asterisks, alphanumeric codes, terminal IDs
- Remove date suffixes like "-14MAY" or "*20260514"
- Remove "WWW." prefix if present
- Shorten to recognizable brand: "SWIGGY TECHNOLOGIES PVT LTD BANGALORE" → "Swiggy"
- Examples:
  "POS AMAZON.IN DELHI" → "Amazon"
  "SWIGGY TECHNOLOGIES PVT LTD" → "Swiggy"
  "ZOMATO MEDIA PVT LTD" → "Zomato"
  "NETFLIX.COM 866-716-0414 IRL" → "Netflix"
  "UBER INDIA SYS PVT LTD" → "Uber"
  "ANI TECHNOLOGIES PVT LTD" → "Ola"
  "HDFC BANK INSTAEMI FOR AMAZON" → "Amazon (EMI)"
  "GOOGLE *YOUTUBE DUBLIN" → "YouTube"
  "APPLE.COM/BILL" → "Apple"
  "BHARTI AIRTEL LTD" → "Airtel"
  "RELIANCE JIO" → "Jio"
`;

function buildCCSystemPrompt(bank: BankHint): string {
  const bankSpecific: Record<string, string> = {
    hdfc: `
HDFC Credit Card Statement specifics:
- Columns: Transaction Date | Posting Date | Description | Debit (INR) | Credit (INR)
- Date format: DD/MM/YY or DD-MMM-YY
- SKIP (exclude) these credit lines: "PAYMENT RECEIVED", "NEFT CR", "HDFC REWARD POINT REDEMPTION", "CASHBACK CREDIT"
- INCLUDE as bank_fee: "HDFC BANK FINANCE CHARGES", "HDFC BANK ANNUAL FEE", "HDFC BANK LATE PAYMENT FEE", "HDFC BANK PROC FEE", "HDFC BANK JOINING FEE", "GST ON CHARGES"
- INCLUDE as loan_emi: any description containing "INSTAEMI", "EMI CONV", "FLEXIPAY"
- INCLUDE as cash: "CASH ADVANCE AT ATM", "CASH WITHDRAWAL"
- For debit-only columns: use the Debit(INR) column value`,

    sbi: `
SBI Card Statement specifics:
- Columns: Date | Slip Ref No | Transaction Details | Debit | Credit
- Date format: DD/MM/YYYY or DD MMM YY
- SKIP: "PAYMENT RECEIVED THANK YOU", "REWARDS REDEMPTION CASHBACK", "CASHBACK CREDIT", "OPENING BALANCE"
- INCLUDE as bank_fee: "SBI CARD FINANCE CHARGES", "SBI CARD ANNUAL FEE", "SBI CARD LATE CHARGES", "SBI CARD RENEWAL FEE", "SBI CARD JOINING FEE"
- INCLUDE as loan_emi: descriptions with "SBI CARD EMI", "EASY EMI", "FLEXI PAY"
- INCLUDE as cash: "SBI CARD ATM CASH ADVANCE"
- Foreign currency: note "INTERNATIONAL" in description; still use INR converted amount`,

    icici: `
ICICI Bank Credit Card Statement specifics:
- Columns: Date | Transaction | Debit Amount (INR) | Credit Amount (INR)
- Also shown: ICICI Excel export with columns Date | Sr No | Description | Intl Ref | Amount | Reward Points
- Date format: DD/MM/YYYY
- SKIP: "PAYMENT RECEIVED - THANK YOU", "CASHBACK CREDIT", "ICICI PAYBACK CASHBACK", "REWARD ADJUSTMENT"
- INCLUDE as bank_fee: "INTEREST CHARGES", "LATE PAYMENT CHARGE", "ANNUAL FEE", "JOINING FEE", "OVER LIMIT FEE", "FOREIGN TRANSACTION FEE"
- INCLUDE as loan_emi: descriptions with "EMI", "AUTO DEBIT EMI", "ICICI BANK EMI"
- INCLUDE as cash: "CASH ADVANCE", "CASH@BANK ATM"`,

    axis: `
Axis Bank Credit Card Statement specifics:
- Columns: Date | Transaction Details | MCC | Amount (Rs.) Dr/Cr
- OR: Date | Description | Debit | Credit
- Date format: DD/MM/YYYY or DD-MM-YYYY
- MCC codes present: 5411=Grocery, 5912=Pharmacy, 5541=Auto Fuel, 9399=Govt, etc. — use for category hint
- SKIP: "PAYMENT RECEIVED", "EDGE REWARD CASHBACK", "CASHBACK CREDIT", "OPENING BALANCE"
- INCLUDE as bank_fee: "INTEREST CHARGED", "LATE PAYMENT FEE", "ANNUAL MEMBERSHIP FEE", "JOINING FEE", "FOREX MARKUP", "FUEL SURCHARGE FEE"
- INCLUDE as loan_emi: descriptions with "EMI", "EQUATED MONTHLY"
- INCLUDE as cash: "CASH ADVANCE"
- Common prefixes to strip from merchant name: "POS ", "ONLINE "`,

    kotak: `
Kotak Mahindra Credit Card Statement specifics:
- Columns: Transaction Date | Description | Amount (or Debit | Credit)
- Date format: DD/MM/YYYY or DD-MMM-YYYY
- SKIP: "PAYMENT THROUGH KOTAK NETBANKING", "PAYMENT RECEIVED", "REWARD REDEMPTION", "CASHBACK CREDIT"
- INCLUDE as bank_fee: "FINANCE CHARGES", "LATE PAYMENT CHARGES", "ANNUAL FEES", "RENEWAL FEES", "JOINING FEES", "FOREIGN TRANSACTION CHARGES"
- INCLUDE as loan_emi: "KOTAK EMI", "EASY EMI", "FLEXI LOAN"
- INCLUDE as cash: "CASH ADVANCE"`,

    indusind: `
IndusInd Bank Credit Card Statement specifics:
- Columns: Date | Transaction Details | MCC | Amount (Dr/Cr)
- MCC codes present — use for category classification
- SKIP: "PAYMENT THANK YOU", "CASHBACK CREDIT", "REWARD REDEMPTION"
- INCLUDE as bank_fee: "FINANCE CHARGES", "LATE PAYMENT FEE", "ANNUAL FEE", "JOINING FEE", "FOREX MARKUP"
- INCLUDE as loan_emi: descriptions with "EMI"
- INCLUDE as cash: "CASH ADVANCE"`,

    idfc: `
IDFC FIRST Bank Credit Card Statement specifics:
- Columns: Transaction Date | Transaction Details | EMI Eligibility | FX Indicator | Amount (INR)
- EMI Eligibility column: Y/N — transactions marked Y can be converted to EMI
- FX Indicator: Y if foreign currency transaction
- Date format: DD/MM/YYYY
- SKIP: "PAYMENT RECEIVED", "CASHBACK CREDIT", "REWARD POINTS CREDIT"
- INCLUDE as bank_fee: "INTEREST CHARGES", "LATE PAYMENT FEE", "ANNUAL FEE", "JOINING FEE", "FOREX MARKUP FEE"
- INCLUDE as loan_emi: descriptions containing "EMI" in Transaction Details
- INCLUDE as cash: "CASH ADVANCE"`,

    amex: `
American Express India Credit Card Statement specifics:
- Columns: Reference Number | Date | Description | Amount
- Date format: DD/MM/YYYY (India) — NOTE: some older statements may show MM/DD/YY (US format)
- SKIP: "PAYMENT - THANK YOU", "PAYMENT RECEIVED", "CASHBACK CREDIT", "MEMBERSHIP REWARDS REDEMPTION"
- INCLUDE as bank_fee: "ANNUAL FEE", "LATE FEE", "FINANCE CHARGE", "INTEREST CHARGE", "FOREIGN TRANSACTION FEE"
- INCLUDE as cash: "CASH ADVANCE"
- No POS/ONLINE prefix typically`,

    rbl: `
RBL Bank Credit Card Statement specifics:
- Columns: Date | Transaction Details | Amount (Dr/Cr)
- Date format: DD/MM/YYYY
- SKIP: "PAYMENT RECEIVED", "CASHBACK CREDIT", "REWARD REDEMPTION"
- INCLUDE as bank_fee: "FINANCE CHARGE", "LATE PAYMENT FEE", "ANNUAL FEE", "JOINING FEE", "FOREX MARKUP"
- INCLUDE as loan_emi: descriptions with "EMI"
- INCLUDE as cash: "CASH ADVANCE"`,

    yes: `
Yes Bank Credit Card Statement specifics:
- Columns: Date | Transaction Details | Amount (Rs.)
- Date format: DD/MM/YYYY
- SKIP: "PAYMENT RECEIVED", "CASHBACK CREDIT", "REWARD POINTS REDEMPTION"
- INCLUDE as bank_fee: "FINANCE CHARGES", "LATE PAYMENT FEE", "ANNUAL FEE", "JOINING FEE"
- INCLUDE as loan_emi: descriptions with "EMI"
- INCLUDE as cash: "CASH ADVANCE"`,
  };

  const bankSection = bank !== 'auto' && bankSpecific[bank]
    ? bankSpecific[bank]
    : `
Auto-detect bank: read the statement header to identify HDFC/SBI/ICICI/Axis/Kotak/IndusInd/IDFC/AmEx/RBL/Yes Bank.
Apply the corresponding parsing rules based on the detected bank.
Common to all banks:
- SKIP: "PAYMENT RECEIVED*", "OPENING BALANCE", "CLOSING BALANCE", "MINIMUM DUE", "TOTAL DUE", "CASHBACK CREDIT*", "REWARD REDEMPTION*"
- bank_fee: "FINANCE CHARGES", "INTEREST CHARGED*", "LATE PAYMENT*", "ANNUAL FEE*", "JOINING FEE*", "FOREX MARKUP*", "FUEL SURCHARGE*"
- loan_emi: any row containing "EMI"
- cash: "CASH ADVANCE"`;

  return `You are an expert Indian credit card statement parser.

## What to include vs skip

INCLUDE (debit/spend transactions):
- All merchant purchases
- Interest, finance charges, late fees, annual/joining fee, forex markup, fuel surcharge → bank_fee
- EMI conversions and installments → loan_emi
- Cash advances at ATM → cash
- Insurance premiums charged to card → insurance

SKIP entirely (do NOT output these rows):
- Payment received / Payment thank you (these are the cardholder paying their bill)
- Cashback credits / Reward point redemptions
- Opening balance / Closing balance / Previous balance
- Minimum due / Total amount due / Available credit limit lines
- Credit note / Refund / Reversal (money coming back to card)

## Bank-specific instructions
${bankSection}

## Merchant name cleaning
${CC_MERCHANT_CLEANING}

## MCC → Category mapping (when MCC codes are visible)
5411,5412,5441,5451,5462,5499 → Food & Dining (grocery/supermarket)
5812,5813,5814 → Food & Dining (restaurants/bars)
5541,5542,5551 → Transport (fuel stations)
4111,4112,4131 → Transport (transit/rideshare)
4411,4511,4722 → Travel (airlines, travel agencies)
5734,5732,5045 → Shopping (electronics)
5600,5621,5631,5651,5661,5691,5699 → Shopping (apparel)
5912,7297,8049 → Health & Medical
7011 → Travel (hotels)
7832,7922,7941 → Entertainment (movies, events, sports)
4899,4813,4816 → Bills & Utilities (cable, telecom, internet)
8220,8241,8299 → Education
6300,6311 → Bills & Utilities (insurance)
6010,6011 → cash (ATM withdrawal)

## Category classification guide
- Food & Dining: restaurants, food delivery (Swiggy, Zomato), groceries, cafes
- Transport: Uber/Ola, flights, trains (IRCTC), metro, petrol, FastTag tolls
- Shopping: Amazon, Flipkart, Myntra, physical stores, electronics
- Entertainment: Netflix, Hotstar, Spotify, cinema, gaming
- Bills & Utilities: electricity, gas, water, mobile recharge, broadband, society dues
- Health & Medical: pharmacies, hospitals, doctor consults, lab tests
- Travel: hotels, OYO, MakeMyTrip, international travel
- Education: school/college fees, online courses, ed-tech
- Personal Care: salon, spa, gym, beauty products
- Other: anything that doesn't fit above

${TRANSACTION_TYPE_GUIDE}

${OUTPUT_SCHEMA}`;
}

function buildBankAccountSystemPrompt(includeCredits: boolean, bank: BankHint): string {
  const bankSection: Record<string, string> = {
    hdfc: `HDFC Savings Account CSV format:
Columns: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt.(INR ) | Deposit Amt.(INR ) | Closing Balance(INR )
- UPI debit narration: "UPI/DR/REF/MERCHANT NAME/BANK/VPA" → extract merchant name
- UPI credit narration: "UPI/CR/REF/SENDER/BANK/VPA" → income if includeCredits
- NEFT/IMPS debit: "NEFT/CMS/REF/BENEFICIARY" → transfer or expense
- NACH/ECS debit: likely loan_emi or insurance
- ATM: "ATM/BRANCH/DATE/REF" → cash`,

    icici: `ICICI Bank Savings Account format:
Columns: Transaction Date | Transaction Remarks | Withdrawal Amount(INR) | Deposit Amount(INR) | Balance(INR)
- UPI format: "UPI-MERCHANT NAME-VPA@BANK-REFNO"
- NEFT credit: "NEFT-BANK-SENDER NAME/REMARKS"
- Cheque: cheque number in remarks`,

    sbi: `SBI Savings Account format:
Columns: Txn Date | Description | Ref No./Cheque No. | Debit | Credit | Balance
- UPI debit: "TO TRANSFER-UPI/REF/MERCHANT/VPA"
- Salary credit: "BY TRANSFER NEFT/REF/COMPANY NAME"`,

    axis: `Axis Bank Savings Account format:
Columns: Tran Date | PARTICULARS | Dr Amount | Cr Amount | Balance
- UPI: "UPI/P2M/MERCHANTBENGALURU/REFNO" → P2M = person-to-merchant
- UPI P2P: "UPI/P2P/NAME/REFNO" → transfer`,

    kotak: `Kotak Bank Savings Account format:
Columns: Date | Description | Chq/Ref No | Debit | Credit | Balance
- UPI payment: "UPI/VPA/MERCHANT NAME/REF"`,
  };

  const bankHint = bank !== 'auto' && bankSection[bank] ? bankSection[bank] : `
Auto-detect the bank from statement header. Common formats:
- HDFC: "HDFC BANK" header, columns include "Withdrawal Amt" and "Deposit Amt"
- ICICI: "ICICI BANK" header, columns include "Withdrawal Amount" and "Deposit Amount"
- SBI: "State Bank of India" header
- Axis: "AXIS BANK" header
- Kotak: "KOTAK MAHINDRA" header`;

  return `You are an expert Indian bank savings/current account statement parser.

${includeCredits
  ? 'Extract ALL transactions — debits (money OUT) AND credits (money IN: salary, UPI received, interest, dividends).'
  : 'Extract ONLY debit transactions — money going OUT of the account. Skip all credits, incoming transfers, salary, interest.'}

## Bank-specific format
${bankHint}

## UPI description parsing
UPI narrations contain the merchant/payee name — extract just the clean name:
- "UPI/DR/24050123456/SWIGGY IND/ICICI/swiggy@icici" → merchant: "Swiggy"
- "UPI-ZOMATO MEDIA-ZOMATOUI@ICICI-123456" → merchant: "Zomato"
- "UPI/P2M/AMAZONFASHION/ref" → merchant: "Amazon"
- "NEFT/CMS/12345/LICHFL HOME LOAN" → merchant: "LIC Housing Finance", type: loan_emi
- "NACH/ECS/HDFC LIFE" → merchant: "HDFC Life", type: insurance
- "NACH EMI BAJAJ FINSERV" → merchant: "Bajaj Finance", type: loan_emi

## Transaction type classification
- expense: UPI payments to merchants, POS purchases, debit card transactions
- income: salary credit, UPI received, NEFT/IMPS received, interest credit
- transfer: NEFT/IMPS/RTGS to another person, own account transfer, wallet top-up
- investment: SIP/NACH to mutual funds, Zerodha/Groww, FD creation
- loan_emi: NACH/ECS/NEFT to lenders, descriptions with "EMI", "LOAN INSTALLMENT"
- insurance: NACH/ECS to insurance companies, LIC/HDFC Life/ICICI Pru/Star Health etc.
- bank_fee: service charges, annual fee, GST charges, locker fee, SMS charges
- cc_payment: NEFT/payment to "HDFC CREDIT CARD", "SBI CARD", "AXIS BANK CC" etc.
- cash: ATM WDL, cash withdrawal

## What to SKIP entirely
- Opening balance / Closing balance rows
- Statement header/footer rows
- Column header rows
${includeCredits ? '' : '- All credits/deposits/incoming transactions'}

${TRANSACTION_TYPE_GUIDE}

${OUTPUT_SCHEMA}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

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
        case 'contains':   return t.includes(p);
        case 'startsWith': return t.startsWith(p);
        case 'equals':     return t === p;
        case 'regex':      try { return new RegExp(rule.pattern, 'i').test(target ?? ''); } catch { return false; }
        default:           return false;
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

// ─────────────────────────────────────────────────────────────────────────────
// API HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      content,
      includeCredits = false,
      statementType = 'bank' as StatementType,
      bank = 'auto' as BankHint,
    } = body as {
      type: 'pdf' | 'csv';
      content: string;
      includeCredits?: boolean;
      statementType?: StatementType;
      bank?: BankHint;
    };

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const db = getDb();
    const rules = db.prepare('SELECT * FROM transaction_rules ORDER BY priority DESC, id ASC').all() as MappingRule[];

    const SYSTEM = statementType === 'cc'
      ? buildCCSystemPrompt(bank)
      : buildBankAccountSystemPrompt(includeCredits, bank);

    const userInstruction = statementType === 'cc'
      ? 'Extract all debit transactions (purchases, fees, EMIs) from this credit card statement. Skip payment received, cashback credits, reward redemptions, and balance lines.'
      : `Extract all ${includeCredits ? '' : 'debit '}transactions from this bank statement.`;

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
              { type: 'text', text: userInstruction },
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
          content: `${userInstruction}\n\n${content}`,
        }],
      });
      rawText = msg.content.find(b => b.type === 'text')?.text ?? '[]';
    }

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ transactions: [] });

    const raw: (ImportedTransaction & { transaction_type?: string })[] = JSON.parse(jsonMatch[0]);

    const dupCheck = db.prepare(
      `SELECT COUNT(*) as c FROM expenses WHERE date = ? AND ABS(amount - ?) < 0.01 AND LOWER(merchant) = LOWER(?)`
    );

    const transactions: ImportedTransaction[] = raw.map(t => {
      const aiType = (TRANSACTION_TYPES as readonly string[]).includes(t.transaction_type ?? '')
        ? (t.transaction_type as TransactionType)
        : 'expense';

      const ruleMatch = applyRules({ description: t.description, merchant: t.merchant }, rules);

      const transaction_type = ruleMatch ? ruleMatch.transaction_type : aiType;
      const category = ruleMatch?.category ? ruleMatch.category : t.category;
      const action = ruleMatch ? ruleMatch.action : 'include';

      const { c } = dupCheck.get(t.date, t.amount, t.merchant ?? '') as { c: number };
      const duplicate = c > 0;

      return {
        ...t,
        transaction_type,
        category,
        duplicate,
        checked: !duplicate && action === 'include' && TRANSACTION_TYPE_CONFIG[transaction_type].defaultInclude,
      };
    });

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Failed to parse statement' }, { status: 500 });
  }
}
