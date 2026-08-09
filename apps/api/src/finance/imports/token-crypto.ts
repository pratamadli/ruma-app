import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { loadApiEnv } from '../../config/env';

function keyBytes(): Buffer | null {
  const env = loadApiEnv();
  const hex = env.EMAIL_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

/** Encrypt OAuth token for at-rest storage. Returns null if encryption key unset. */
export function encryptToken(plain: string): string | null {
  const key = keyBytes();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(payload: string): string | null {
  const key = keyBytes();
  if (!key) return null;
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function fingerprintCandidate(input: {
  type: string;
  amountMinor: bigint;
  transactionDate: string;
  description: string | null;
  merchant: string | null;
}): string {
  const label = (input.description ?? input.merchant ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const raw = `${input.type}|${input.amountMinor.toString()}|${input.transactionDate}|${label}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
