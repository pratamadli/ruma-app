import type { ParsedEmailCandidate, RawEmailMessage } from '../types';

/**
 * BCA-style notification (simplified, fixture-driven).
 * Matches common patterns without storing real bank mail.
 */
export function parseBcaEmail(message: RawEmailMessage): ParsedEmailCandidate | null {
  const from = message.from.toLowerCase();
  const subject = message.subject.toLowerCase();
  const body = message.textBody;

  const looksBca =
    from.includes('bca.co.id') ||
    from.includes('bca@') ||
    subject.includes('bca') ||
    /bank central asia/i.test(body);
  if (!looksBca) return null;

  const amountMatch = body.match(/(?:Rp|IDR)\s*([\d.]+)/i) ?? body.match(/Amount\s*:\s*([\d.]+)/i);
  const amountDigits = amountMatch?.[1]?.replace(/\./g, '') ?? null;

  const dateMatch =
    body.match(/(\d{4}-\d{2}-\d{2})/) ??
    body.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);

  let date: string | null = null;
  if (dateMatch) {
    if (dateMatch[0].includes('-')) {
      date = dateMatch[1] ?? null;
    } else {
      date = toIsoDate(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!);
    }
  }

  const merchantMatch =
    body.match(/Merchant\s*:\s*(.+)/i) ?? body.match(/di\s+([A-Za-z0-9 &.-]+)/i);
  const merchant = merchantMatch?.[1]?.trim() ?? null;

  const isCredit =
    /kredit|received|incoming|transfer masuk|dana masuk/i.test(body) ||
    /transfer received/i.test(subject);
  const isTransfer = /antar rekening|transfer ke|transfer from/i.test(body);
  const type = isTransfer ? 'TRANSFER' : isCredit ? 'INCOME' : 'EXPENSE';

  if (!amountDigits || !/^\d+$/.test(amountDigits)) {
    return {
      parserProvider: 'BCA',
      transactionType: type,
      amountMinor: null,
      currency: 'IDR',
      transactionDate: date,
      description: merchant,
      merchant,
      reference: null,
      accountHint: 'BCA',
      categoryHint: null,
      confidence: 'LOW',
      parseError: 'Missing or invalid amount',
    };
  }

  if (!date) {
    return {
      parserProvider: 'BCA',
      transactionType: type,
      amountMinor: BigInt(amountDigits),
      currency: 'IDR',
      transactionDate: null,
      description: merchant,
      merchant,
      reference: null,
      accountHint: 'BCA',
      categoryHint: null,
      confidence: 'LOW',
      parseError: 'Missing date',
    };
  }

  return {
    parserProvider: 'BCA',
    transactionType: type,
    amountMinor: BigInt(amountDigits),
    currency: 'IDR',
    transactionDate: date,
    description: merchant,
    merchant,
    reference: null,
    accountHint: 'BCA',
    categoryHint: type === 'EXPENSE' ? 'Food & Dining' : type === 'INCOME' ? 'Salary' : null,
    confidence: type === 'TRANSFER' ? 'MEDIUM' : 'HIGH',
    parseError: null,
  };
}

function toIsoDate(day: string, mon: string, year: string): string {
  const months: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const m = months[mon.slice(0, 3).toLowerCase()] ?? '01';
  return `${year}-${m}-${day.padStart(2, '0')}`;
}
