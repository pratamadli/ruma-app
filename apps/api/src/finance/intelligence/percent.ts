import { moneyToString } from '../money';

/** One-decimal percentage: (part/whole)*100, or null if whole=0. */
export function percentOf(part: bigint, whole: bigint): number | null {
  if (whole === 0n) return null;
  const tenths = Number((part * 1000n) / whole);
  return tenths / 10;
}

/** MoM % change: (current-previous)/previous*100, null if previous=0. */
export function percentChange(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  const diff = current - previous;
  const tenths = Number((diff * 1000n) / previous);
  return tenths / 10;
}

export function moneyDiffString(current: bigint, previous: bigint): string {
  return moneyToString(current - previous);
}

export function medianBigInt(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2n;
}

export function averageBigInt(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  let sum = 0n;
  for (const v of values) sum += v;
  return sum / BigInt(values.length);
}

export function normalizeDescription(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
