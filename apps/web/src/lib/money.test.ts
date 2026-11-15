import { expect, it } from 'vitest';
import { parseIdrInput } from './money';

it('accepts rupiah grouping without silently changing invalid input into money', () => {
  expect(parseIdrInput('45.000')).toBe('45000');
  expect(parseIdrInput('999999999999999')).toBe('999999999999999');
  for (const input of ['-45000', '45.5', '4e5', 'abc123', '1,25', '1000000000000000']) {
    expect(parseIdrInput(input)).toBeNull();
  }
});
