export interface ParsedUpiSms {
  amount: number;
  type: 'income' | 'expense';
  merchant: string;
  upiRef: string | null;
  date: string;
  rawNote: string;
  accountHint: string;
}

const AMOUNT_PATTERNS = [
  /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:sent|received)\s+(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:debited|credited)\s+(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /([\d,]+(?:\.\d{1,2})?)\s*(?:debited|credited)/i,
];

const DEBIT_KEYWORDS = ['debited', 'debit', 'sent', 'paid', 'withdrawn', 'purchase'];
const CREDIT_KEYWORDS = ['credited', 'credit', 'received', 'refund', 'cashback'];

const REF_PATTERNS = [
  /(?:UPI\s*(?:Ref|ref|REF)(?:\s*(?:No|no|NO))?[:\s]*)([\w\d]+)/,
  /(?:UTR[:\s]*)([\w\d]+)/,
  /(?:Ref[:\s]*)([\d]{12,})/,
  /(?:txn\s*(?:id|no)?[:\s]*)([\w\d]+)/i,
];

const ACCOUNT_PATTERN = /(?:A\/c|a\/c|account|acct?)[\s:]*(?:(?:XX|xx|[Xx*]+)(\d{4,}))/;

const MERCHANT_PATTERNS = [
  /(?:Info:\s*)(.+?)(?:\.|$)/i,
  /(?:to|from)\s+([A-Za-z0-9@._\s]+?)(?:\s+via|\s+on|\s*\.|$)/i,
  /(?:at|@)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s*\.|$)/i,
  /VPA\s+([\w.@]+)/i,
];

function extractAmount(body: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const num = parseFloat(raw);
      if (num > 0 && num < 10_000_000) return num;
    }
  }
  return null;
}

function extractType(body: string): 'income' | 'expense' {
  const lower = body.toLowerCase();
  for (const kw of CREDIT_KEYWORDS) {
    if (lower.includes(kw)) return 'income';
  }
  for (const kw of DEBIT_KEYWORDS) {
    if (lower.includes(kw)) return 'expense';
  }
  return 'expense';
}

function extractRef(body: string): string | null {
  for (const pattern of REF_PATTERNS) {
    const match = body.match(pattern);
    if (match && match[1].length >= 6) return match[1];
  }
  return null;
}

function extractAccountHint(body: string): string {
  const match = body.match(ACCOUNT_PATTERN);
  return match ? match[1] : '';
}

function extractMerchant(body: string): string {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      let merchant = match[1].trim();
      merchant = merchant.replace(/@[\w.]+$/, '').trim();
      if (merchant.length > 2 && merchant.length < 60) return merchant;
    }
  }
  return 'UPI Transaction';
}

export function parseUpiSms(body: string, _sender: string, timestamp: number): ParsedUpiSms | null {
  const amount = extractAmount(body);
  if (!amount) return null;

  const type = extractType(body);
  const upiRef = extractRef(body);
  const accountHint = extractAccountHint(body);
  const merchant = extractMerchant(body);
  const date = new Date(timestamp).toISOString().slice(0, 10);

  const rawNote = upiRef ? `[UPI:${upiRef}] ${merchant}` : merchant;

  return { amount, type, merchant, upiRef, date, rawNote, accountHint };
}

export function isUpiSms(body: string): boolean {
  const lower = body.toLowerCase();
  const hasAmount = AMOUNT_PATTERNS.some(p => p.test(body));
  const hasUpiIndicator = lower.includes('upi') || lower.includes('utr') ||
    (lower.includes('debited') && lower.includes('a/c')) ||
    (lower.includes('credited') && lower.includes('a/c')) ||
    lower.includes('sent rs') || lower.includes('received rs');
  return hasAmount && hasUpiIndicator;
}
