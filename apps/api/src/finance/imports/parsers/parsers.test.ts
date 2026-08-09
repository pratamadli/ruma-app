import { describe, expect, it } from 'vitest';
import { SYNTHETIC_FIXTURES } from '../fixtures/synthetic-fixtures';
import { parseTransactionEmail } from './index';
import { parseBcaEmail } from './bca.parser';
import { parseGopayEmail } from './gopay.parser';
import { parseMandiriEmail } from './mandiri.parser';
import { parseSyntheticBankEmail } from './synthetic-bank.parser';

describe('transaction email parsers', () => {
  it('parses synthetic expense', () => {
    const message = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'synth-expense-001')!;
    const parsed = parseSyntheticBankEmail(message);
    expect(parsed?.transactionType).toBe('EXPENSE');
    expect(parsed?.amountMinor).toBe(150000n);
    expect(parsed?.currency).toBe('IDR');
    expect(parsed?.merchant).toBe('Restaurant ABC');
    expect(parsed?.confidence).toBe('HIGH');
    expect(parsed?.parseError).toBeNull();
  });

  it('parses synthetic income', () => {
    const message = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'synth-income-001')!;
    const parsed = parseSyntheticBankEmail(message);
    expect(parsed?.transactionType).toBe('INCOME');
    expect(parsed?.amountMinor).toBe(15000000n);
    expect(parsed?.confidence).toBe('HIGH');
  });

  it('parses synthetic transfer', () => {
    const message = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'synth-transfer-001')!;
    const parsed = parseSyntheticBankEmail(message);
    expect(parsed?.transactionType).toBe('TRANSFER');
    expect(parsed?.amountMinor).toBe(500000n);
  });

  it('fails when amount is missing', () => {
    const message = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'synth-malformed-001')!;
    const parsed = parseSyntheticBankEmail(message);
    expect(parsed?.parseError).toMatch(/amount/i);
    expect(parsed?.amountMinor).toBeNull();
    expect(parsed?.confidence).toBe('LOW');
  });

  it('flags unsupported currency', () => {
    const parsed = parseSyntheticBankEmail({
      providerMessageId: 'usd-1',
      from: 'alerts@synthetic-bank.example.test',
      subject: 'Payment',
      receivedAt: new Date(),
      textBody: `
PROVIDER: SYNTHETIC_BANK
TYPE: EXPENSE
AMOUNT: 100
CURRENCY: USD
DATE: 2026-08-08
MERCHANT: Shop
`.trim(),
    });
    expect(parsed?.parseError).toMatch(/currency/i);
    expect(parsed?.confidence).toBe('LOW');
  });

  it('parses BCA-style expense fixture', () => {
    const message = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'bca-expense-001')!;
    const parsed = parseBcaEmail(message);
    expect(parsed?.parserProvider).toBe('BCA');
    expect(parsed?.transactionType).toBe('EXPENSE');
    expect(parsed?.amountMinor).toBe(125000n);
    expect(parsed?.merchant).toBe('Cafe Demo');
  });

  it('parses Mandiri expense and income fixtures', () => {
    const expense = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'mandiri-expense-001')!;
    const income = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'mandiri-income-001')!;
    expect(parseMandiriEmail(expense)?.amountMinor).toBe(85000n);
    expect(parseMandiriEmail(expense)?.transactionType).toBe('EXPENSE');
    expect(parseMandiriEmail(income)?.transactionType).toBe('INCOME');
    expect(parseMandiriEmail(income)?.amountMinor).toBe(2500000n);
  });

  it('parses GoPay expense and top-up fixtures', () => {
    const expense = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'gopay-expense-001')!;
    const topup = SYNTHETIC_FIXTURES.find((m) => m.providerMessageId === 'gopay-topup-001')!;
    expect(parseGopayEmail(expense)?.amountMinor).toBe(45000n);
    expect(parseGopayEmail(expense)?.categoryHint).toBe('Transportation');
    expect(parseGopayEmail(topup)?.transactionType).toBe('INCOME');
  });

  it('returns null for unrelated email', () => {
    const parsed = parseTransactionEmail({
      providerMessageId: 'noise',
      from: 'friend@example.com',
      subject: 'Dinner plans',
      receivedAt: new Date(),
      textBody: 'Want to grab dinner?',
    });
    expect(parsed).toBeNull();
  });
});
