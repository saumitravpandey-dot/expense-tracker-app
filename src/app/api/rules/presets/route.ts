import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// The full preset rule list — mirrors the seed in db.ts
// Tuple: [pattern, match_type, apply_to, tx_type, category, action, priority, note]
type PresetRow = [string, string, string, string, string, string, number, string];

const PRESETS: PresetRow[] = [
  // ─── PRIORITY 99: CC REFUNDS / REVERSALS / PAYMENTS ON STATEMENT (exclude) ───
  // These appear in CC statements as credits — should be skipped entirely
  ['PAYMENT RECEIVED', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'CC payment received (credit on statement)'],
  ['PAYMENT THANK YOU', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'CC payment acknowledgement'],
  ['PAYMENT - THANK YOU', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'AmEx payment received'],
  ['PAYMENT THRU NETBANKING', 'contains', 'description', 'cc_payment', '', 'exclude', 99, 'CC payment via net banking'],
  ['REWARD POINT REDEMPTION', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'Reward points redeemed'],
  ['REWARD REDEMPTION', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'Reward redemption credit'],
  ['POINTS REDEMPTION', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'Points redemption'],
  ['CASHBACK CREDIT', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'Cashback credited to CC'],
  ['CASHBACK REVERSAL', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'Cashback reversal'],
  ['REVERSAL OF', 'startsWith', 'description', 'transfer', '', 'exclude', 99, 'Transaction reversal (refund)'],
  ['CREDIT NOTE', 'contains', 'description', 'transfer', '', 'exclude', 99, 'Credit note (refund)'],
  ['REFUND FROM', 'startsWith', 'description', 'transfer', '', 'exclude', 99, 'Merchant refund'],
  ['PAYBACK CASHBACK', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'ICICI PayBack cashback'],
  ['EDGE REWARD', 'contains', 'both', 'cc_payment', '', 'exclude', 99, 'Axis Edge reward redemption'],
  ['OPENING BALANCE', 'contains', 'description', 'transfer', '', 'exclude', 99, 'Statement opening balance line'],
  ['CLOSING BALANCE', 'contains', 'description', 'transfer', '', 'exclude', 99, 'Statement closing balance line'],

  // ─── PRIORITY 98: CC BANK FEES (include as bank_fee) ───
  // CC-specific fee patterns — these are expenses on your CC statement
  ['FINANCE CHARGES', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC finance/interest charges'],
  ['INTEREST CHARGES', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC interest charged'],
  ['INTEREST CHARGED', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC interest charged'],
  ['LATE PAYMENT CHARGE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC late payment charge'],
  ['LATE CHARGES', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC late payment charge (SBI format)'],
  ['ANNUAL MEMBERSHIP FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC annual membership fee'],
  ['ANNUAL FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC annual fee'],
  ['RENEWAL FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC renewal fee'],
  ['JOINING FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC joining fee'],
  ['FOREX MARKUP', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Foreign exchange markup fee'],
  ['FOREIGN TRANSACTION FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Foreign currency transaction fee'],
  ['FCY TRANSACTION', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Foreign currency transaction fee'],
  ['FOREIGN CURRENCY MARKUP', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Forex markup fee'],
  ['FUEL SURCHARGE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Fuel surcharge on CC'],
  ['OVER LIMIT FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CC over-limit fee'],
  ['CASH ADVANCE FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Cash advance transaction fee'],
  ['PROC FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'Processing fee (HDFC)'],
  ['GST ON CHARGES', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'GST applied on CC charges'],
  ['CGST', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'CGST on bank charges'],
  ['SGST', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'SGST on bank charges'],
  ['IGST', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 98, 'IGST on bank charges'],

  // ─── PRIORITY 97: CC CASH ADVANCE ───
  ['CASH ADVANCE', 'contains', 'description', 'cash', '', 'include', 97, 'Cash advance on credit card'],
  ['ATM CASH ADVANCE', 'contains', 'description', 'cash', '', 'include', 97, 'ATM cash advance on CC'],
  ['CASH@BANK', 'contains', 'description', 'cash', '', 'include', 97, 'ICICI cash advance at bank'],

  // ─── PRIORITY 96: CC EMI PATTERNS ───
  ['INSTAEMI', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'HDFC InstaEMI conversion'],
  ['FLEXIPAY', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'HDFC FlexiPay EMI'],
  ['EASY EMI', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'Easy EMI conversion'],
  ['EMI CONV', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'EMI conversion on CC'],
  ['EMI FOR', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'EMI for specific purchase'],
  ['EASY LOANS', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'Easy Loans (Axis)'],
  ['FLEXI LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 96, 'FlexiLoan on CC'],

  // ─── PRIORITY 100: CC PAYMENTS ───
  ['CREDIT CARD', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Credit card bill payment'],
  ['CC BILL', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Credit card bill'],
  ['CREDITCARD', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Credit card payment'],
  ['CCPAYMENT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'CC payment shorthand'],
  ['AMEX', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Amex card payment'],
  ['HDFC CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'HDFC credit card payment'],
  ['ICICI CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'ICICI credit card'],
  ['AXIS CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Axis credit card payment'],
  ['SBI CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'SBI credit card payment'],
  ['KOTAK CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Kotak credit card'],
  ['CITI CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Citibank credit card'],
  ['YES CREDIT', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Yes Bank credit card'],
  ['BILL PAYMENT CC', 'contains', 'description', 'cc_payment', '', 'exclude', 100, 'Generic CC bill payment'],
  ['CC-', 'startsWith', 'description', 'cc_payment', '', 'exclude', 100, 'CC payment prefix'],

  // ─── PRIORITY 90: OWN TRANSFERS ───
  ['SELF TRANSFER', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Transfer to own account'],
  ['TO SAVINGS', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Transfer to savings'],
  ['SWEEP IN', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Sweep-in from FD/savings'],
  ['SWEEP OUT', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Sweep-out'],
  ['OWN ACCOUNT', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Own account transfer'],
  ['INTERNAL TRANSFER', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Internal bank transfer'],
  ['FD OPENING', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Fixed deposit creation'],
  ['FD CREATION', 'contains', 'description', 'transfer', '', 'exclude', 90, 'FD booking'],
  ['FD-', 'startsWith', 'description', 'transfer', '', 'exclude', 90, 'FD prefix'],
  ['RD OPENING', 'contains', 'description', 'transfer', '', 'exclude', 90, 'Recurring deposit creation'],
  ['TRANSFER TO', 'startsWith', 'description', 'transfer', '', 'exclude', 90, 'Outward transfer'],
  ['NEFT TO SELF', 'contains', 'description', 'transfer', '', 'exclude', 90, 'NEFT self transfer'],

  // ─── PRIORITY 85: INVESTMENTS ───
  ['/SIP/', 'contains', 'description', 'investment', '', 'exclude', 85, 'Mutual fund SIP'],
  ['SIP DEBIT', 'contains', 'description', 'investment', '', 'exclude', 85, 'SIP auto-debit'],
  ['MUTUAL FUND', 'contains', 'description', 'investment', '', 'exclude', 85, 'Mutual fund purchase'],
  ['MF-', 'startsWith', 'description', 'investment', '', 'exclude', 85, 'MF prefix'],
  ['DEMAT', 'contains', 'description', 'investment', '', 'exclude', 85, 'Demat account investment'],
  ['ZERODHA', 'contains', 'both', 'investment', '', 'exclude', 85, 'Zerodha broker'],
  ['GROWW', 'contains', 'both', 'investment', '', 'exclude', 85, 'Groww investment app'],
  ['KUVERA', 'contains', 'both', 'investment', '', 'exclude', 85, 'Kuvera MF platform'],
  ['PAYTM MONEY', 'contains', 'both', 'investment', '', 'exclude', 85, 'Paytm Money investments'],
  ['ET MONEY', 'contains', 'both', 'investment', '', 'exclude', 85, 'ET Money MF'],
  ['COIN BY ZERODHA', 'contains', 'both', 'investment', '', 'exclude', 85, 'Zerodha Coin'],
  ['5PAISA', 'contains', 'both', 'investment', '', 'exclude', 85, '5Paisa broker'],
  ['UPSTOX', 'contains', 'both', 'investment', '', 'exclude', 85, 'Upstox broker'],
  ['ANGEL BROKING', 'contains', 'both', 'investment', '', 'exclude', 85, 'Angel Broking'],
  ['BSE STAR', 'contains', 'description', 'investment', '', 'exclude', 85, 'BSE Star MF platform'],
  ['NSE CLEARING', 'contains', 'description', 'investment', '', 'exclude', 85, 'NSE clearing'],
  ['PPFAS', 'contains', 'both', 'investment', '', 'exclude', 85, 'PPFAS Mutual Fund'],
  ['GOLDENPI', 'contains', 'both', 'investment', '', 'exclude', 85, 'GoldenPi bonds'],

  // ─── PRIORITY 80: INSURANCE ───
  ['LIC PREMIUM', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include', 80, 'LIC life insurance'],
  ['LIC OF INDIA', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include', 80, 'LIC policy'],
  ['INSURANCE', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include', 80, 'Generic insurance'],
  ['HDFC ERGO', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'HDFC ERGO insurance'],
  ['HDFC LIFE', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'HDFC Life insurance'],
  ['ICICI LOMBARD', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'ICICI Lombard general ins'],
  ['ICICI PRUDENTIAL', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'ICICI Pru life'],
  ['SBI LIFE', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'SBI Life'],
  ['SBI GENERAL', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'SBI General insurance'],
  ['STAR HEALTH', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'Star Health insurance'],
  ['BAJAJ ALLIANZ', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'Bajaj Allianz'],
  ['NEW INDIA ASSURANCE', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'New India Assurance'],
  ['NATIONAL INSURANCE', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'National Insurance Co.'],
  ['TATA AIA', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'Tata AIA life'],
  ['TATA AIG', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'Tata AIG general'],
  ['MAX LIFE', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'Max Life Insurance'],
  ['POLICYBAZAAR', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'PolicyBazaar premium'],
  ['COVERFOX', 'contains', 'both', 'insurance', 'Bills & Utilities', 'include', 80, 'Coverfox insurance'],
  ['NACH DEBIT LIC', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include', 80, 'NACH auto-debit LIC'],
  ['ECS LIC', 'contains', 'description', 'insurance', 'Bills & Utilities', 'include', 80, 'ECS LIC premium'],

  // ─── PRIORITY 75: LOAN EMIs ───
  ['HOME LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Home loan EMI'],
  ['CAR LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Car loan EMI'],
  ['VEHICLE LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Vehicle loan'],
  ['PERSONAL LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Personal loan EMI'],
  ['EDUCATION LOAN', 'contains', 'description', 'loan_emi', 'Education', 'include', 75, 'Education loan EMI'],
  ['GOLD LOAN', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Gold loan EMI'],
  [' EMI ', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'EMI payment'],
  ['EMI-', 'startsWith', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'EMI prefix'],
  ['EQUATED MONTHLY', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Full EMI phrase'],
  ['NACH DEBIT EMI', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'NACH EMI auto-debit'],
  ['ECS EMI', 'contains', 'description', 'loan_emi', 'Bills & Utilities', 'include', 75, 'ECS loan EMI'],
  ['BAJAJ FINANCE', 'contains', 'both', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Bajaj Finance EMI'],
  ['HDFC HOME', 'contains', 'both', 'loan_emi', 'Bills & Utilities', 'include', 75, 'HDFC home loan'],
  ['LICHFL', 'contains', 'both', 'loan_emi', 'Bills & Utilities', 'include', 75, 'LIC Housing Finance loan'],
  ['PNBHFL', 'contains', 'both', 'loan_emi', 'Bills & Utilities', 'include', 75, 'PNB Housing Finance'],
  ['LENDINGKART', 'contains', 'both', 'loan_emi', 'Bills & Utilities', 'include', 75, 'Lendingkart loan'],

  // ─── PRIORITY 70: BANK FEES ───
  ['SERVICE CHARGE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Bank service charge'],
  ['ANNUAL FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Credit card annual fee'],
  ['PROCESSING FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Loan/transaction processing fee'],
  ['LATE PAYMENT', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Late payment penalty'],
  ['OVERDRAFT', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Overdraft charge'],
  ['GST CHARGE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'GST on banking charges'],
  ['SMS CHARGES', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'SMS alert charges'],
  ['DEBIT CARD FEE', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Debit card charges'],
  ['LOCKER CHARGES', 'contains', 'description', 'bank_fee', 'Bills & Utilities', 'include', 70, 'Locker rent'],

  // ─── PRIORITY 65: ATM / CASH ───
  ['ATM WDL', 'contains', 'description', 'cash', '', 'include', 65, 'ATM withdrawal'],
  ['ATM CASH', 'contains', 'description', 'cash', '', 'include', 65, 'ATM cash withdrawal'],
  ['CASH WITHDRAWAL', 'contains', 'description', 'cash', '', 'include', 65, 'Cash withdrawal'],
  ['ATM-', 'startsWith', 'description', 'cash', '', 'include', 65, 'ATM prefix in bank statement'],
  ['CDM', 'contains', 'description', 'cash', '', 'include', 65, 'Cash Deposit Machine'],

  // ─── PRIORITY 50: FOOD & DINING ───
  ['SWIGGY', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Swiggy food delivery'],
  ['ZOMATO', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Zomato food delivery'],
  ['BLINKIT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Blinkit groceries/food'],
  ['ZEPTO', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Zepto quick commerce'],
  ['DUNZO', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Dunzo delivery'],
  ['BIGBASKET', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'BigBasket groceries'],
  ['GROFERS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Blinkit/Grofers'],
  ['DOMINOS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, "Domino's pizza"],
  ['PIZZA HUT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Pizza Hut'],
  ['KFC', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'KFC restaurant'],
  ['MCDONALDS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, "McDonald's"],
  ['MCDONALD', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, "McDonald's"],
  ['STARBUCKS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Starbucks coffee'],
  ['CAFE COFFEE DAY', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Café Coffee Day'],
  ['CCD', 'contains', 'merchant', 'expense', 'Food & Dining', 'include', 50, 'CCD coffee'],
  ['BARISTA', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Barista coffee'],
  ['HALDIRAMS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, "Haldiram's"],
  ['JUBILANT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, "Jubilant Foodworks (Domino's)"],
  ['RESTAURANT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Generic restaurant'],
  ['LICIOUS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Licious meat delivery'],

  // ─── PRIORITY 50: TRANSPORT ───
  ['UBER', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Uber cab'],
  ['OLA', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Ola cab'],
  ['RAPIDO', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Rapido bike taxi'],
  ['MERU', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Meru cab'],
  ['IRCTC', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Indian Railways booking'],
  ['INDIAN RAILWAYS', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Indian Railways'],
  ['INDIGO', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'IndiGo airlines'],
  ['AIR INDIA', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Air India'],
  ['SPICEJET', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'SpiceJet airlines'],
  ['GO AIR', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'GoAir / Go First'],
  ['VISTARA', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Vistara airlines'],
  ['AKASA AIR', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Akasa Air'],
  ['METRO', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Metro recharge/fare'],
  ['BMTC', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Bengaluru Metro/bus'],
  ['KSRTC', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Karnataka state transport'],
  ['REDBUS', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'RedBus ticket booking'],
  ['YULU', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Yulu electric bike'],
  ['BOUNCE', 'contains', 'merchant', 'expense', 'Transport', 'include', 50, 'Bounce scooter rental'],
  ['FUEL', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Fuel / petrol'],
  ['PETROL', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Petrol station'],
  ['DIESEL', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Diesel'],
  ['FASTAG', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'FASTag toll recharge'],
  ['PARKING', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Parking fee'],

  // ─── PRIORITY 50: SHOPPING ───
  ['AMAZON', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Amazon shopping'],
  ['FLIPKART', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Flipkart shopping'],
  ['MYNTRA', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Myntra fashion'],
  ['AJIO', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'AJIO fashion'],
  ['MEESHO', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Meesho marketplace'],
  ['SNAPDEAL', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Snapdeal shopping'],
  ['TATACLIQ', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Tata CLiQ'],
  ['CROMA', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Croma electronics'],
  ['RELIANCE DIGITAL', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Reliance Digital'],
  ['VIJAY SALES', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Vijay Sales'],
  ['DMART', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'D-Mart retail'],
  ['BIG BAZAAR', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Big Bazaar'],
  ['RELIANCE SMART', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Reliance Smart'],
  ['SPENCER', 'contains', 'both', 'expense', 'Shopping', 'include', 50, "Spencer's retail"],
  ['MORE SUPERMARKET', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'More Supermarket'],

  // ─── PRIORITY 50: ALTERNATE MERCHANT NAMES (CC statement format) ───
  // These appear verbosely on CC statements — mapped to correct categories
  // Transport
  ['ANI TECHNOLOGIES', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Ola Cabs (legal name: ANI Technologies)'],
  ['MERU CABS', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Meru cab service'],
  ['MOVE IN SYNC', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Meru/Move in Sync'],
  ['ORLA TECHNOLOGIES', 'contains', 'both', 'expense', 'Transport', 'include', 50, 'Ola Electric'],
  // Food delivery
  ['SWIGGY TECHNOLOGIES', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Swiggy (legal name)'],
  ['BUNDL TECHNOLOGIES', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Swiggy (Bundl Technologies)'],
  ['ZOMATO MEDIA', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Zomato (legal: Zomato Media)'],
  ['ETERNAL LTD', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Zomato (Eternal Ltd)'],
  ['BLINKIT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Blinkit groceries'],
  // Shopping
  ['AMAZON SELLER SERV', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Amazon marketplace'],
  ['AMZN MKTP', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Amazon marketplace (short form)'],
  ['AMZNPRIME', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Amazon Prime subscription'],
  ['AMZN DIGITAL', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Amazon digital/Prime'],
  ['FK RETAIL', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Flipkart Retail'],
  ['FLIPKART INTERNET', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Flipkart'],
  // Entertainment/Subscriptions
  ['NETFLIX.COM', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Netflix (domain format on CC)'],
  ['SPOTIFY.COM', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Spotify (domain format)'],
  ['SPOTIFY INDIA', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Spotify India'],
  ['GOOGLE *YOUTUBE', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'YouTube Premium'],
  ['GOOGLE YOUTUBE', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'YouTube Premium'],
  ['YOUTUBE PREMIUM', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'YouTube Premium'],
  ['GOOGLE PLAY', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Google Play Store'],
  ['APPLE.COM/BILL', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Apple subscriptions/App Store'],
  ['APPLE ITUNES', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Apple iTunes/App Store'],
  ['AMAZON PRIME', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Amazon Prime membership'],
  ['PRIMEVIDEO', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Amazon Prime Video'],
  ['HOTSTAR INDIA', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Disney+ Hotstar'],
  ['NOVI DIGITAL', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Hotstar (Novi Digital)'],
  ['JIOCINEMA', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'JioCinema OTT'],
  ['RELIANCE JIO', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Jio telecom/broadband'],
  // Bills / Utilities
  ['BHARTI AIRTEL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Airtel (legal name: Bharti Airtel)'],
  ['VODAFONE IDEA', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Vi (Vodafone Idea)'],
  ['TATA COMMUNICATIONS', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tata Communications internet'],
  // Digital wallets / Payments (usually expense pass-through)
  ['PHONEPE PRIVATE', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'PhonePe merchant payment'],
  ['PAYTM PAYMENTS BANK', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Paytm merchant payment'],
  ['RAZORPAY', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Razorpay payment gateway'],
  ['BILLDESK', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'BillDesk utility payment'],
  // Health
  ['APOLLO HEALTH', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Apollo Hospitals/Pharmacy'],
  ['MEDPLUS', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'MedPlus pharmacy chain'],
  ['WELLNESS FOREVER', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Wellness Forever pharmacy'],
  ['TATA 1MG', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Tata 1mg'],
  // Education
  ['THINK AND LEARN', 'contains', 'both', 'expense', 'Education', 'include', 50, "BYJU'S (Think and Learn)"],
  ['SORTING HAT TECH', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Unacademy (Sorting Hat)'],
  // Personal care / Fitness
  ['CURE.FIT', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Cult.fit fitness'],
  ['CUREFIT', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Cult.fit fitness'],
  ['NYKAA FASHION', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Nykaa Fashion'],
  // Tech
  ['MICROSOFT INDIA', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Microsoft 365 / Xbox'],
  ['MICROSOFT *', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Microsoft subscription'],
  ['GOOGLE *WORKSPACE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Google Workspace'],
  ['GOOGLE *GSUITE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Google GSuite'],
  ['ADOBE SYSTEMS', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Adobe Creative Cloud'],
  ['GITHUB', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'GitHub subscription'],
  ['CHAT GPT', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'ChatGPT Plus / OpenAI'],
  ['OPENAI', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'OpenAI subscription'],

  // ─── PRIORITY 50: ENTERTAINMENT ───
  ['NETFLIX', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Netflix subscription'],
  ['PRIME VIDEO', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Amazon Prime Video'],
  ['AMAZON PRIME', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Amazon Prime membership'],
  ['HOTSTAR', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Disney+ Hotstar'],
  ['DISNEY', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Disney+ streaming'],
  ['SONY LIV', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'SonyLIV streaming'],
  ['SONYLIV', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'SonyLIV'],
  ['ZEE5', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'ZEE5 streaming'],
  ['VOOT', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Voot streaming'],
  ['MXPLAYER', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'MX Player'],
  ['SPOTIFY', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Spotify music'],
  ['GAANA', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Gaana music'],
  ['JIOSAAVN', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'JioSaavn music'],
  ['WYNK', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Wynk Music'],
  ['YOUTUBE PREMIUM', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'YouTube Premium'],
  ['BOOKMYSHOW', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'BookMyShow tickets'],
  ['PVR', 'contains', 'merchant', 'expense', 'Entertainment', 'include', 50, 'PVR Cinemas'],
  ['INOX', 'contains', 'merchant', 'expense', 'Entertainment', 'include', 50, 'INOX Cinemas'],
  ['CINEPOLIS', 'contains', 'both', 'expense', 'Entertainment', 'include', 50, 'Cinepolis cinema'],

  // ─── PRIORITY 50: BILLS & UTILITIES ───
  ['BESCOM', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Bangalore Electricity (BESCOM)'],
  ['MSEDCL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Maharashtra Electricity (MSEDCL)'],
  ['TATA POWER', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tata Power electricity'],
  ['RELIANCE ENERGY', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Reliance Energy'],
  ['BSES', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'BSES Delhi electricity'],
  ['CESC', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'CESC Kolkata electricity'],
  ['WBSEDCL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'West Bengal electricity'],
  ['TNEB', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tamil Nadu electricity'],
  ['KSEB', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Kerala electricity'],
  ['ELECTRICITY', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Generic electricity bill'],
  ['IGL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Indraprastha Gas (IGL)'],
  ['MGL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Mahanagar Gas (MGL)'],
  ['MAHANAGAR GAS', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Mahanagar Gas'],
  ['GAS BILL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Piped gas bill'],
  ['PIPED GAS', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Piped natural gas'],
  ['AIRTEL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Airtel telecom'],
  ['VODAFONE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Vodafone mobile'],
  ['JIO', 'contains', 'merchant', 'expense', 'Bills & Utilities', 'include', 50, 'Jio mobile/broadband'],
  ['JIOTELECOM', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Jio telecom'],
  ['VI PAYMENT', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Vi (Vodafone Idea)'],
  ['BSNL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'BSNL'],
  ['TATA TELE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tata Teleservices'],
  ['MOBILE RECHARGE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Mobile recharge'],
  ['ACT FIBERNET', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'ACT Fibernet'],
  ['SPECTRANET', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Spectranet broadband'],
  ['HATHWAY', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Hathway broadband'],
  ['EXCITEL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Excitel broadband'],
  ['TIKONA', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tikona broadband'],
  ['WATER BILL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Water utility bill'],
  ['MAINTENANCE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Society maintenance'],
  ['SOCIETY DUES', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Housing society dues'],

  // ─── PRIORITY 50: HEALTH & MEDICAL ───
  ['APOLLO PHARMACY', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Apollo Pharmacy'],
  ['1MG', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, '1mg medicine delivery'],
  ['NETMEDS', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Netmeds online pharmacy'],
  ['PRACTO', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Practo doctor consultation'],
  ['MEDLIFE', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Medlife pharmacy'],
  ['PORTEA', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Portea home health'],
  ['PHARMEASY', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'PharmEasy pharmacy'],
  ['TATA HEALTH', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Tata Health'],
  ['LYBRATE', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Lybrate consultation'],
  ['HEALTHIANS', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Healthians diagnostics'],
  ['THYROCARE', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Thyrocare lab tests'],
  ['HOSPITAL', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Hospital payment'],
  ['CLINIC', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Medical clinic'],
  ['PHARMACY', 'contains', 'both', 'expense', 'Health & Medical', 'include', 50, 'Generic pharmacy'],

  // ─── PRIORITY 50: EDUCATION ───
  ['BYJU', 'contains', 'both', 'expense', 'Education', 'include', 50, "BYJU'S ed-tech"],
  ['UNACADEMY', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Unacademy'],
  ['VEDANTU', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Vedantu'],
  ['COURSERA', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Coursera online courses'],
  ['UDEMY', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Udemy courses'],
  ['SKILLSHARE', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Skillshare'],
  ['SCHOOL FEE', 'contains', 'both', 'expense', 'Education', 'include', 50, 'School fees'],
  ['COLLEGE FEE', 'contains', 'both', 'expense', 'Education', 'include', 50, 'College fees'],
  ['TUITION', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Tuition fees'],
  ['TOPPR', 'contains', 'both', 'expense', 'Education', 'include', 50, 'Toppr ed-tech'],

  // ─── PRIORITY 50: PERSONAL CARE ───
  ['NYKAA', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Nykaa beauty/cosmetics'],
  ['PURPLLE', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Purplle cosmetics'],
  ['MAMAEARTH', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Mamaearth personal care'],
  ['MCAFFEINE', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'mCaffeine'],
  ['PLUM', 'contains', 'merchant', 'expense', 'Personal Care', 'include', 50, 'Plum cosmetics'],
  ['SALON', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Salon/beauty parlour'],
  ['SPA', 'contains', 'merchant', 'expense', 'Personal Care', 'include', 50, 'Spa service'],
  ['GYM', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Gym membership'],
  ['FITNESS', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Fitness subscription'],
  ['CULT FIT', 'contains', 'both', 'expense', 'Personal Care', 'include', 50, 'Cult.fit fitness'],

  // ─── PRIORITY 50: TRAVEL ───
  ['MAKEMYTRIP', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'MakeMyTrip'],
  ['GOIBIBO', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Goibibo travel'],
  ['CLEARTRIP', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Cleartrip'],
  ['YATRA', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Yatra travel'],
  ['OYO', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'OYO hotels'],
  ['TREEBO', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Treebo hotels'],
  ['FABHOTELS', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'FabHotels'],
  ['AIRBNB', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Airbnb accommodation'],
  ['AGODA', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Agoda hotel booking'],
  ['BOOKING.COM', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Booking.com'],
  ['HOTELS.COM', 'contains', 'both', 'expense', 'Travel', 'include', 50, 'Hotels.com'],
];

export async function POST() {
  const db = getDb();

  // Check for existing rules (to avoid duplicates) using pattern+match_type+apply_to as unique key
  const existing = db.prepare(
    'SELECT pattern, match_type, apply_to FROM transaction_rules'
  ).all() as { pattern: string; match_type: string; apply_to: string }[];

  const existingSet = new Set(
    existing.map(r => `${r.pattern.toUpperCase()}|${r.match_type}|${r.apply_to}`)
  );

  const ins = db.prepare(
    'INSERT INTO transaction_rules (pattern, match_type, apply_to, tx_type, category, action, priority, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  let added = 0;
  let skipped = 0;

  const insertMany = db.transaction(() => {
    for (const [pattern, match_type, apply_to, tx_type, category, action, priority, note] of PRESETS) {
      const key = `${pattern.toUpperCase()}|${match_type}|${apply_to}`;
      if (existingSet.has(key)) {
        skipped++;
      } else {
        ins.run(pattern, match_type, apply_to, tx_type, category, action, priority, note);
        added++;
      }
    }
  });

  insertMany();

  return NextResponse.json({
    added,
    skipped,
    total: PRESETS.length,
    message: `Added ${added} preset rules (${skipped} already existed).`,
  });
}

export async function GET() {
  return NextResponse.json({ total: PRESETS.length });
}
