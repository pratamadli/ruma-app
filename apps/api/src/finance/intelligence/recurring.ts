import type { RecurringPatternResponse } from '@ruma/types';
import { formatDateOnly, moneyToString } from '../money';
import { medianBigInt, normalizeDescription } from './percent';

export type ExpenseForRecurring = {
  id: string;
  amountMinor: bigint;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  transactionDate: Date;
};

const MONTHLY_MIN_DAYS = 25;
const MONTHLY_MAX_DAYS = 35;
const AMOUNT_TOLERANCE = 0.2; // ±20% of median

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function amountNearMedian(amount: bigint, median: bigint): boolean {
  if (median === 0n) return amount === 0n;
  const lo = (median * 80n) / 100n;
  const hi = (median * 120n) / 100n;
  return amount >= lo && amount <= hi;
}

function looksMonthly(dates: Date[]): boolean {
  if (dates.length < 3) return false;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  let monthlyIntervals = 0;
  for (let i = 1; i < sorted.length; i++) {
    const d = daysBetween(sorted[i - 1]!, sorted[i]!);
    if (d >= MONTHLY_MIN_DAYS && d <= MONTHLY_MAX_DAYS) monthlyIntervals += 1;
  }
  if (monthlyIntervals >= Math.max(2, sorted.length - 2)) return true;

  const daySet = new Set(sorted.map((d) => d.getUTCDate()));
  const monthKeys = new Set(sorted.map((d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`));
  // Same day-of-month across ≥3 distinct months
  if (monthKeys.size >= 3 && daySet.size === 1) return true;
  // Majority share the same day-of-month
  const dayCounts = new Map<number, number>();
  for (const d of sorted) {
    const day = d.getUTCDate();
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const maxDayCount = Math.max(...dayCounts.values());
  return monthKeys.size >= 3 && maxDayCount >= 3;
}

export function detectRecurringPatterns(
  expenses: ExpenseForRecurring[],
): RecurringPatternResponse[] {
  const groups = new Map<string, ExpenseForRecurring[]>();

  for (const txn of expenses) {
    const desc = normalizeDescription(txn.description);
    if (!desc) continue;
    const key = `${txn.categoryId ?? 'none'}::${desc}`;
    const list = groups.get(key) ?? [];
    list.push(txn);
    groups.set(key, list);
  }

  const patterns: RecurringPatternResponse[] = [];

  for (const [, list] of groups) {
    if (list.length < 3) continue;
    const amounts = list.map((t) => t.amountMinor);
    const med = medianBigInt(amounts);
    if (med == null) continue;
    if (!amounts.every((a) => amountNearMedian(a, med))) continue;

    const dates = list.map((t) => t.transactionDate);
    if (!looksMonthly(dates)) continue;

    const sorted = [...list].sort(
      (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime(),
    );
    const sample = sorted[0]!;

    patterns.push({
      label: sample.description?.trim() || 'Recurring expense',
      categoryId: sample.categoryId,
      categoryName: sample.categoryName,
      typicalAmountMinor: moneyToString(med),
      occurrenceCount: list.length,
      cadence: 'MONTHLY',
      confidence: 'LIKELY',
      firstSeen: formatDateOnly(sorted[0]!.transactionDate),
      lastSeen: formatDateOnly(sorted[sorted.length - 1]!.transactionDate),
    });
  }

  return patterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 8);
}

// silence unused constant lint if any
void AMOUNT_TOLERANCE;
