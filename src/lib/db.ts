import Database from 'better-sqlite3';
import path from 'path';

// On Vercel the project root is read-only; use /tmp which is writable (512 MB, ephemeral per instance)
const DB_PATH = process.env.VERCEL
  ? '/tmp/expenses.db'
  : path.join(process.cwd(), 'expenses.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL,
      currency    TEXT    NOT NULL DEFAULT 'INR',
      merchant    TEXT    NOT NULL DEFAULT '',
      category    TEXT    NOT NULL DEFAULT 'Other',
      date        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      source      TEXT    NOT NULL DEFAULT 'manual',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT    UNIQUE NOT NULL,
      amount   REAL    NOT NULL,
      currency TEXT    NOT NULL DEFAULT 'INR'
    );
    CREATE TABLE IF NOT EXISTS transaction_rules (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern    TEXT    NOT NULL,
      match_type TEXT    NOT NULL DEFAULT 'contains',
      apply_to   TEXT    NOT NULL DEFAULT 'description',
      tx_type    TEXT    NOT NULL,
      category   TEXT    NOT NULL DEFAULT '',
      action     TEXT    NOT NULL DEFAULT 'include',
      enabled    INTEGER NOT NULL DEFAULT 1,
      priority   INTEGER NOT NULL DEFAULT 0,
      note       TEXT    NOT NULL DEFAULT '',
      amount_min REAL,
      amount_max REAL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations
  try { _db.exec(`ALTER TABLE expenses ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'expense'`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE transaction_rules ADD COLUMN priority INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE transaction_rules ADD COLUMN note TEXT NOT NULL DEFAULT ''`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE transaction_rules ADD COLUMN amount_min REAL`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE transaction_rules ADD COLUMN amount_max REAL`); } catch { /* already exists */ }

  // Seed comprehensive mapping rules (only if table is empty)
  const ruleCount = (_db.prepare('SELECT COUNT(*) as c FROM transaction_rules').get() as { c: number }).c;
  if (ruleCount === 0) {
    const ins = _db.prepare(
      'INSERT INTO transaction_rules (pattern, match_type, apply_to, tx_type, category, action, priority, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const seed: [string, string, string, string, string, string, number, string][] = [

      // ─── PRIORITY 100: CC PAYMENTS (exclude — avoid double counting) ───
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

      // ─── PRIORITY 90: OWN TRANSFERS (exclude) ───
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

      // ─── PRIORITY 85: INVESTMENTS (exclude) ───
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

      // ─── PRIORITY 80: INSURANCE (include, Bills & Utilities) ───
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

      // ─── PRIORITY 75: LOAN EMIs (include, Bills & Utilities) ───
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

      // ─── PRIORITY 70: BANK FEES (include, Bills & Utilities) ───
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

      // ─── PRIORITY 50: FOOD & DINING (expense) ───
      ['SWIGGY', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Swiggy food delivery'],
      ['ZOMATO', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Zomato food delivery'],
      ['BLINKIT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Blinkit groceries/food'],
      ['ZEPTO', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Zepto quick commerce'],
      ['DUNZO', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Dunzo delivery'],
      ['BIGBASKET', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'BigBasket groceries'],
      ['GROFERS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Blinkit/Grofers'],
      ['DOMINOS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Domino\'s pizza'],
      ['PIZZA HUT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Pizza Hut'],
      ['KFC', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'KFC restaurant'],
      ['MCDONALDS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'McDonald\'s'],
      ['MCDONALD', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'McDonald\'s'],
      ['STARBUCKS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Starbucks coffee'],
      ['CAFE COFFEE DAY', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Café Coffee Day'],
      ['CCD', 'contains', 'merchant', 'expense', 'Food & Dining', 'include', 50, 'CCD coffee'],
      ['BARISTA', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Barista coffee'],
      ['HALDIRAMS', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Haldiram\'s'],
      ['JUBILANT', 'contains', 'both', 'expense', 'Food & Dining', 'include', 50, 'Jubilant Foodworks (Domino\'s)'],
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
      ['DMart', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'D-Mart retail'],
      ['DMART', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'D-Mart'],
      ['BIG BAZAAR', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Big Bazaar'],
      ['RELIANCE SMART', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Reliance Smart'],
      ['SPENCER', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'Spencer\'s retail'],
      ['MORE SUPERMARKET', 'contains', 'both', 'expense', 'Shopping', 'include', 50, 'More Supermarket'],

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
      // Electricity
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
      // Gas
      ['IGL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Indraprastha Gas (IGL)'],
      ['MGL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Mahanagar Gas (MGL)'],
      ['MAHANAGAR GAS', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Mahanagar Gas'],
      ['GAS BILL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Piped gas bill'],
      ['PIPED GAS', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Piped natural gas'],
      // Telecom
      ['AIRTEL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Airtel telecom'],
      ['VODAFONE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Vodafone mobile'],
      ['JIO', 'contains', 'merchant', 'expense', 'Bills & Utilities', 'include', 50, 'Jio mobile/broadband'],
      ['JIOTELECOM', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Jio telecom'],
      ['VI PAYMENT', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Vi (Vodafone Idea)'],
      ['BSNL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'BSNL'],
      ['TATA TELE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tata Teleservices'],
      ['MOBILE RECHARGE', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Mobile recharge'],
      // Broadband
      ['ACT FIBERNET', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'ACT Fibernet'],
      ['SPECTRANET', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Spectranet broadband'],
      ['HATHWAY', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Hathway broadband'],
      ['EXCITEL', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Excitel broadband'],
      ['TIKONA', 'contains', 'both', 'expense', 'Bills & Utilities', 'include', 50, 'Tikona broadband'],
      // Water / Society
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
      ['BYJU', 'contains', 'both', 'expense', 'Education', 'include', 50, 'BYJU\'S ed-tech'],
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

    for (const r of seed) ins.run(...r);
  }

  return _db;
}
