import { beforeEach, describe, expect, it } from 'vitest';
import { resetApiEnvCache } from '../../config/env';
import { decryptToken, encryptToken, fingerprintCandidate } from './token-crypto';

describe('token crypto', () => {
  beforeEach(() => {
    resetApiEnvCache();
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters!!';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters!';
    process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ruma';
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  it('encrypts and decrypts tokens', () => {
    const enc = encryptToken('oauth-access-token');
    expect(enc).toBeTruthy();
    expect(enc).not.toContain('oauth-access-token');
    expect(decryptToken(enc!)).toBe('oauth-access-token');
  });

  it('fingerprints candidates stably', () => {
    const a = fingerprintCandidate({
      type: 'EXPENSE',
      amountMinor: 150000n,
      transactionDate: '2026-08-08',
      description: 'Dinner',
      merchant: 'Restaurant ABC',
    });
    const b = fingerprintCandidate({
      type: 'EXPENSE',
      amountMinor: 150000n,
      transactionDate: '2026-08-08',
      description: 'Dinner',
      merchant: 'Restaurant ABC',
    });
    expect(a).toBe(b);
  });
});
