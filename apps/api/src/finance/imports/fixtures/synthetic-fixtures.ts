import type { RawEmailMessage } from '../types';

/** Sanitized synthetic emails — no real PII. Dates are relative to “now” for lookback sync. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const SYNTHETIC_FIXTURES: RawEmailMessage[] = [
  {
    providerMessageId: 'synth-expense-001',
    from: 'alerts@synthetic-bank.example.test',
    subject: 'Transaction Notification',
    receivedAt: daysAgo(1),
    textBody: `
PROVIDER: SYNTHETIC_BANK
TYPE: EXPENSE
AMOUNT: 150000
CURRENCY: IDR
DATE: ${todayYmd()}
MERCHANT: Restaurant ABC
DESCRIPTION: Dinner
ACCOUNT: BCA
REFERENCE: REF-EXP-001
CATEGORY: Food & Dining
`.trim(),
  },
  {
    providerMessageId: 'synth-income-001',
    from: 'alerts@synthetic-bank.example.test',
    subject: 'Transfer Received',
    receivedAt: daysAgo(2),
    textBody: `
PROVIDER: SYNTHETIC_BANK
TYPE: INCOME
AMOUNT: 15000000
CURRENCY: IDR
DATE: ${todayYmd()}
MERCHANT: Employer
DESCRIPTION: Salary
ACCOUNT: BCA
REFERENCE: REF-INC-001
CATEGORY: Salary
`.trim(),
  },
  {
    providerMessageId: 'synth-transfer-001',
    from: 'alerts@synthetic-bank.example.test',
    subject: 'Transfer Notification',
    receivedAt: daysAgo(3),
    textBody: `
PROVIDER: SYNTHETIC_BANK
TYPE: TRANSFER
AMOUNT: 500000
CURRENCY: IDR
DATE: ${todayYmd()}
DESCRIPTION: Top up
ACCOUNT: BCA
REFERENCE: REF-TRF-001
`.trim(),
  },
  {
    providerMessageId: 'synth-malformed-001',
    from: 'alerts@synthetic-bank.example.test',
    subject: 'Broken Notification',
    receivedAt: daysAgo(1),
    textBody: `
PROVIDER: SYNTHETIC_BANK
TYPE: EXPENSE
CURRENCY: IDR
DATE: ${todayYmd()}
MERCHANT: Mystery Shop
`.trim(),
  },
  {
    providerMessageId: 'bca-expense-001',
    from: 'bca@bca.co.id',
    subject: 'BCA Transaction Notification',
    receivedAt: daysAgo(2),
    textBody: `
Bank Central Asia
Payment Rp125.000
Date: ${todayYmd()}
Merchant: Cafe Demo
`.trim(),
  },
  {
    providerMessageId: 'mandiri-expense-001',
    from: 'noreply@bankmandiri.co.id',
    subject: 'Mandiri Transaction Notification',
    receivedAt: daysAgo(1),
    textBody: `
Bank Mandiri
Debit Rp85.000
Date: ${todayYmd()}
Merchant: Toko Demo
`.trim(),
  },
  {
    providerMessageId: 'mandiri-income-001',
    from: 'noreply@bankmandiri.co.id',
    subject: 'Dana Diterima',
    receivedAt: daysAgo(2),
    textBody: `
Bank Mandiri
Transfer masuk Rp2.500.000
Date: ${todayYmd()}
Pada: Employer Demo
`.trim(),
  },
  {
    providerMessageId: 'gopay-expense-001',
    from: 'noreply@go-jek.com',
    subject: 'GoPay Payment',
    receivedAt: daysAgo(1),
    textBody: `
GoPay
Paid to: Grab
Amount: Rp45.000
Date: ${todayYmd()}
`.trim(),
  },
  {
    providerMessageId: 'gopay-topup-001',
    from: 'noreply@go-jek.com',
    subject: 'GoPay Top Up',
    receivedAt: daysAgo(3),
    textBody: `
GoPay
Top up received Rp100.000
Date: ${todayYmd()}
`.trim(),
  },
];
