import { describe, expect, it } from 'vitest';
import { createTransactionSchema, financeDateSchema, positiveAmountMinorSchema } from './finance';

describe('finance input boundaries', () => {
  it('preserves integer precision and rejects malformed money without throwing', () => {
    expect(positiveAmountMinorSchema.parse('999999999999999')).toBe('999999999999999');
    for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '1e3', '1000000000000000', '']) {
      expect(positiveAmountMinorSchema.safeParse(value).success).toBe(false);
    }
  });

  it('rejects calendar rollover while accepting leap days', () => {
    expect(financeDateSchema.safeParse('2024-02-29').success).toBe(true);
    for (const date of ['2025-02-29', '2026-04-31', '2026-13-01']) {
      expect(financeDateSchema.safeParse(date).success).toBe(false);
    }
  });

  it('requires distinct movement accounts and an explicit adjustment direction', () => {
    const base = { amountMinor: '45000', accountId: 'a'.repeat(26), transactionDate: '2026-11-01' };
    expect(createTransactionSchema.safeParse({ ...base, type: 'INVESTMENT_BUY' }).success).toBe(
      false,
    );
    expect(
      createTransactionSchema.safeParse({
        ...base,
        type: 'TRANSFER',
        transferAccountId: base.accountId,
      }).success,
    ).toBe(false);
    expect(createTransactionSchema.safeParse({ ...base, type: 'BALANCE_ADJUSTMENT' }).success).toBe(
      false,
    );
    expect(
      createTransactionSchema.safeParse({
        ...base,
        type: 'BALANCE_ADJUSTMENT',
        adjustmentDirection: 'DECREASE',
      }).success,
    ).toBe(true);
  });
});
