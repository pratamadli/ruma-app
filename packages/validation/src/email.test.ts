import { describe, expect, it } from 'vitest';
import { emailSchema, normalizeEmail } from './email';

describe('email validation', () => {
  it('normalizes email casing and whitespace', () => {
    expect(normalizeEmail('  Ada@RUMA.app ')).toBe('ada@ruma.app');
  });

  it('parses and normalizes via zod schema', () => {
    const parsed = emailSchema.parse('  Family@Example.com ');
    expect(parsed).toBe('family@example.com');
  });

  it('rejects invalid emails', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });
});
