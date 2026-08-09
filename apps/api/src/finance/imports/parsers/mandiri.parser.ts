import type { ParsedEmailCandidate, RawEmailMessage } from '../types';

/**
 * Bank Mandiri-style notification (sanitized fixture-driven).
 * Matches common debit/credit templates without storing real bank mail.
 */
export function parseMandiriEmail(message: RawEmailMessage): ParsedEmailCandidate | null {
  const from = message.from.toLowerCase();
  const subject = message.subject.toLowerCase();
  const body = message.textBody;

  const looksMandiri =
    from.includes('bankmandiri.co.id') ||
    from.includes('mandiri') ||
    subject.includes('mandiri') ||
    /bank mandiri/i.test(body);
  if (!looksMandiri) return null;

  const amountMatch = body.match(/(?:Rp|IDR)\s*([\d.]+)/i) ?? body.match(/Nominal\s*:\s*([\d.]+)/i);
  const amountDigits = amountMatch?.[1]?.replace(/\./g, '') ?? null;

  const date = extractIsoDate(body) ?? extractNamedDate(body) ?? null;

  const merchantMatch =
    body.match(/(?:Merchant|Ke|Pada)\s*:\s*(.+)/i) ?? body.match(/di\s+([A-Za-z0-9 &.-]+)/i);
  const merchant = merchantMatch?.[1]?.trim().split(/\r?\n/)[0]?.trim() ?? null;

  const isCredit =
    /kredit|received|incoming|transfer masuk|dana masuk|uang masuk/i.test(body) ||
    /transfer diterima|dana diterima/i.test(subject);
  const isTransfer = /antar rekening|transfer ke rekening|pemindahbukuan/i.test(body);
  const type = isTransfer ? 'TRANSFER' : isCredit ? 'INCOME' : 'EXPENSE';

  if (!amountDigits || !/^\d+$/.test(amountDigits)) {
    return fail(type, null, date, merchant, 'Missing or invalid amount');
  }
  if (!date) {
    return fail(type, BigInt(amountDigits), null, merchant, 'Missing date');
  }

  return {
    parserProvider: 'MANDIRI',
    transactionType: type,
    amountMinor: BigInt(amountDigits),
    currency: 'IDR',
    transactionDate: date,
    description: merchant,
    merchant,
    reference: null,
    accountHint: 'Mandiri',
    categoryHint: type === 'EXPENSE' ? 'Shopping' : type === 'INCOME' ? 'Salary' : null,
    confidence: type === 'TRANSFER' ? 'MEDIUM' : 'HIGH',
    parseError: null,
  };
}

function fail(
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER',
  amountMinor: bigint | null,
  date: string | null,
  merchant: string | null,
  parseError: string,
): ParsedEmailCandidate {
  return {
    parserProvider: 'MANDIRI',
    transactionType: type,
    amountMinor,
    currency: 'IDR',
    transactionDate: date,
    description: merchant,
    merchant,
    reference: null,
    accountHint: 'Mandiri',
    categoryHint: null,
    confidence: 'LOW',
    parseError,
  };
}

function extractIsoDate(body: string): string | null {
  const m = body.match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function extractNamedDate(body: string): string | null {
  const m = body.match(
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  );
  if (!m) return null;
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
  const mon = months[m[2]!.slice(0, 3).toLowerCase()] ?? '01';
  return `${m[3]}-${mon}-${m[1]!.padStart(2, '0')}`;
}
