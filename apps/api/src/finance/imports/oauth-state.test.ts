import { beforeEach, describe, expect, it } from 'vitest';
import { resetApiEnvCache } from '../../config/env';
import { createGmailOAuthState, verifyGmailOAuthState } from './oauth-state';

describe('gmail oauth state', () => {
  beforeEach(() => {
    resetApiEnvCache();
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters!!';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters!';
    process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ruma';
  });

  it('round-trips a valid signed state', () => {
    const state = createGmailOAuthState('family11111111111111111111', 'user2222222222222222222222');
    const payload = verifyGmailOAuthState(state, {
      familyId: 'family11111111111111111111',
      actorId: 'user2222222222222222222222',
    });
    expect(payload.familyId).toBe('family11111111111111111111');
    expect(payload.actorId).toBe('user2222222222222222222222');
  });

  it('rejects tampered state', () => {
    const state = createGmailOAuthState('family11111111111111111111', 'user2222222222222222222222');
    expect(() =>
      verifyGmailOAuthState(`${state}x`, {
        familyId: 'family11111111111111111111',
        actorId: 'user2222222222222222222222',
      }),
    ).toThrow();
  });

  it('rejects family mismatch', () => {
    const state = createGmailOAuthState('family11111111111111111111', 'user2222222222222222222222');
    expect(() =>
      verifyGmailOAuthState(state, {
        familyId: 'family99999999999999999999',
        actorId: 'user2222222222222222222222',
      }),
    ).toThrow();
  });
});
