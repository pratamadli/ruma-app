import type { ParsedEmailCandidate, RawEmailMessage } from '../types';

/**
 * GoPay / Gojek payment notification (sanitized fixture-driven).
 */
export function parseGopayEmail(message: RawEmailMessage): ParsedEmailCandidate | null {
  const from = message.from.toLowerCase();
  const subject = message.subject.toLowerCase();
  const body = message.textBody;

  const looksGopay =
    from.includes('gopay') ||
    from.includes('go-jek.com') ||
    from.includes('gojek') ||
    subject.includes('gopay') ||
    /gopay/i.test(body);
  if (!looksGopay) return null;

  const amountMatch = body.match(/(?:Rp|IDR)\s*([\d.]+)/i) ?? body.match(/Amount\s*:\s*([\d.]+)/i);
  const amountDigits = amountMatch?.[1]?.replace(/\./g, '') ?? null;

  const date =
    body.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ??
    (() => {
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
      return `${m[3]}-${months[m[2]!.slice(0, 3).toLowerCase()] ?? '01'}-${m[1]!.padStart(2, '0')}`;
    })();

  const merchantMatch =
    body.match(/(?:Merchant|Toko|Paid to)\s*:\s*(.+)/i) ?? body.match(/ke\s+([A-Za-z0-9 &.-]+)/i);
  const merchant = merchantMatch?.[1]?.trim().split(/\r?\n/)[0]?.trim() ?? null;

  const isTopUp = /top\s*up|isi saldo|received|dana masuk/i.test(body + subject);
  const isTransfer = /transfer ke|kirim ke/i.test(body);
  const type = isTransfer ? 'TRANSFER' : isTopUp ? 'INCOME' : 'EXPENSE';

  if (!amountDigits || !/^\d+$/.test(amountDigits)) {
    return {
      parserProvider: 'GOPAY',
      transactionType: type,
      amountMinor: null,
      currency: 'IDR',
      transactionDate: date,
      description: merchant,
      merchant,
      reference: null,
      accountHint: 'GoPay',
      categoryHint: null,
      confidence: 'LOW',
      parseError: 'Missing or invalid amount',
    };
  }

  if (!date) {
    return {
      parserProvider: 'GOPAY',
      transactionType: type,
      amountMinor: BigInt(amountDigits),
      currency: 'IDR',
      transactionDate: null,
      description: merchant,
      merchant,
      reference: null,
      accountHint: 'GoPay',
      categoryHint: null,
      confidence: 'LOW',
      parseError: 'Missing date',
    };
  }

  let categoryHint: string | null = null;
  if (type === 'EXPENSE') {
    const m = (merchant ?? '').toLowerCase();
    if (m.includes('grab') || m.includes('gojek') || m.includes('transport')) {
      categoryHint = 'Transportation';
    } else if (m.includes('food') || m.includes('resto') || m.includes('cafe')) {
      categoryHint = 'Food & Dining';
    } else {
      categoryHint = 'Shopping';
    }
  }

  return {
    parserProvider: 'GOPAY',
    transactionType: type,
    amountMinor: BigInt(amountDigits),
    currency: 'IDR',
    transactionDate: date,
    description: merchant,
    merchant,
    reference: null,
    accountHint: 'GoPay',
    categoryHint,
    confidence: type === 'TRANSFER' ? 'MEDIUM' : 'HIGH',
    parseError: null,
  };
}
