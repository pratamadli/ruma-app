import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { loadApiEnv } from '../../config/env';

const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStatePayload = {
  familyId: string;
  actorId: string;
  nonce: string;
  exp: number;
};

function signingKey(): string {
  const env = loadApiEnv();
  // Prefer dedicated encryption key; fall back to access secret (always present).
  return env.EMAIL_TOKEN_ENCRYPTION_KEY ?? env.JWT_ACCESS_SECRET;
}

function sign(body: string): string {
  return createHmac('sha256', signingKey()).update(body).digest('base64url');
}

/** CSRF-safe OAuth state: signed payload with TTL (ADR-014). */
export function createGmailOAuthState(familyId: string, actorId: string): string {
  const payload: OAuthStatePayload = {
    familyId,
    actorId,
    nonce: randomBytes(16).toString('hex'),
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyGmailOAuthState(
  state: string,
  expected: { familyId: string; actorId: string },
): OAuthStatePayload {
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BadRequestException({
      code: 'OAUTH_STATE_INVALID',
      message: 'Gmail authorization state is invalid. Please try connecting again.',
    });
  }
  const [body, sig] = parts;
  const expectedSig = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new BadRequestException({
      code: 'OAUTH_STATE_INVALID',
      message: 'Gmail authorization state is invalid. Please try connecting again.',
    });
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
  } catch {
    throw new BadRequestException({
      code: 'OAUTH_STATE_INVALID',
      message: 'Gmail authorization state is invalid. Please try connecting again.',
    });
  }

  if (
    typeof payload.familyId !== 'string' ||
    typeof payload.actorId !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new BadRequestException({
      code: 'OAUTH_STATE_INVALID',
      message: 'Gmail authorization state is invalid. Please try connecting again.',
    });
  }

  if (payload.exp < Date.now()) {
    throw new BadRequestException({
      code: 'OAUTH_STATE_EXPIRED',
      message: 'Gmail authorization expired. Please try connecting again.',
    });
  }

  if (payload.familyId !== expected.familyId || payload.actorId !== expected.actorId) {
    throw new BadRequestException({
      code: 'OAUTH_STATE_MISMATCH',
      message: 'Gmail authorization does not match this family. Please try again.',
    });
  }

  return payload;
}
