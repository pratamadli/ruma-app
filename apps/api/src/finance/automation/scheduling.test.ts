import { describe, expect, it } from 'vitest';
import { resolveRecipients, schedulePeriod } from './scheduling';

describe('finance scheduling rules', () => {
  it('limits personal delivery to the owner and resolves all active household members', () => {
    expect(resolveRecipients('PERSONAL', 'a', [], ['a', 'b', 'c'])).toEqual(['a']);
    expect(() => resolveRecipients('PERSONAL', 'a', ['b'], ['a', 'b'])).toThrow();
    expect(resolveRecipients('HOUSEHOLD', null, [], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(() => resolveRecipients('HOUSEHOLD', null, ['removed'], ['a'])).toThrow();
  });
  it('respects local report time and emits stable monthly keys', () => {
    const schedule = {
      kind: 'MONTHLY_REPORT',
      dueAt: null,
      timezone: 'Asia/Jakarta',
      deliveryDay: 1,
      deliveryHour: 9,
      deliveryMinute: 0,
    };
    expect(schedulePeriod(schedule, new Date('2026-12-01T01:59:59Z'))).toBeNull();
    expect(schedulePeriod(schedule, new Date('2026-12-01T02:00:00Z'))).toBe('2026-12');
    expect(schedulePeriod(schedule, new Date('2026-12-15T02:00:00Z'))).toBe('2026-12');
    expect(schedulePeriod(schedule, new Date('2027-01-01T02:00:00Z'))).toBe('2027-01');
  });
});
