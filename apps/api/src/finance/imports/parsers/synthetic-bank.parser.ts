import type { ParsedEmailCandidate, RawEmailMessage } from '../types';

/**
 * Synthetic bank notification format (fixture / demo).
 *
 * Lines:
 *   PROVIDER: SYNTHETIC_BANK
 *   TYPE: EXPENSE|INCOME|TRANSFER
 *   AMOUNT: 150000
 *   CURRENCY: IDR
 *   DATE: 2026-08-08
 *   MERCHANT: Restaurant ABC
 *   DESCRIPTION: Dinner
 *   ACCOUNT: BCA
 *   REFERENCE: REF-001
 */
export function parseSyntheticBankEmail(message: RawEmailMessage): ParsedEmailCandidate | null {
  if (
    !/synthetic-bank\.example\.test/i.test(message.from) &&
    !/SYNTHETIC_BANK/i.test(message.textBody)
  ) {
    return null;
  }

  const fields = parseKeyValues(message.textBody);
  const amountRaw = fields.amount ?? fields.amount_minor;
  const typeRaw = (fields.type ?? '').toUpperCase();
  const currency = (fields.currency ?? 'IDR').toUpperCase();
  const date = fields.date ?? null;

  if (!amountRaw || !/^\d+$/.test(amountRaw)) {
    return {
      parserProvider: 'SYNTHETIC_BANK',
      transactionType: null,
      amountMinor: null,
      currency,
      transactionDate: date,
      description: fields.description ?? null,
      merchant: fields.merchant ?? null,
      reference: fields.reference ?? null,
      accountHint: fields.account ?? null,
      categoryHint: fields.category ?? null,
      confidence: 'LOW',
      parseError: 'Missing or invalid amount',
    };
  }

  const type =
    typeRaw === 'INCOME' || typeRaw === 'EXPENSE' || typeRaw === 'TRANSFER' ? typeRaw : null;

  if (!type || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      parserProvider: 'SYNTHETIC_BANK',
      transactionType: type,
      amountMinor: BigInt(amountRaw),
      currency,
      transactionDate: date,
      description: fields.description ?? fields.merchant ?? null,
      merchant: fields.merchant ?? null,
      reference: fields.reference ?? null,
      accountHint: fields.account ?? null,
      categoryHint: fields.category ?? null,
      confidence: 'LOW',
      parseError: type ? 'Missing or invalid date' : 'Missing or invalid transaction type',
    };
  }

  if (currency !== 'IDR') {
    return {
      parserProvider: 'SYNTHETIC_BANK',
      transactionType: type,
      amountMinor: BigInt(amountRaw),
      currency,
      transactionDate: date,
      description: fields.description ?? fields.merchant ?? null,
      merchant: fields.merchant ?? null,
      reference: fields.reference ?? null,
      accountHint: fields.account ?? null,
      categoryHint: fields.category ?? null,
      confidence: 'LOW',
      parseError: `Unsupported currency: ${currency}`,
    };
  }

  return {
    parserProvider: 'SYNTHETIC_BANK',
    transactionType: type,
    amountMinor: BigInt(amountRaw),
    currency,
    transactionDate: date,
    description: fields.description ?? fields.merchant ?? null,
    merchant: fields.merchant ?? null,
    reference: fields.reference ?? null,
    accountHint: fields.account ?? null,
    categoryHint: fields.category ?? guessCategory(fields.merchant, type),
    confidence: 'HIGH',
    parseError: null,
  };
}

function parseKeyValues(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.+)\s*$/);
    if (!match) continue;
    out[match[1]!.toLowerCase()] = match[2]!.trim();
  }
  return out;
}

function guessCategory(merchant: string | undefined, type: string): string | null {
  if (type !== 'EXPENSE') return type === 'INCOME' ? 'Salary' : null;
  const m = (merchant ?? '').toLowerCase();
  if (m.includes('restaurant') || m.includes('food') || m.includes('dinner'))
    return 'Food & Dining';
  if (m.includes('grab') || m.includes('gojek') || m.includes('transport')) return 'Transportation';
  return null;
}
