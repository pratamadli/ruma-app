import type { BudgetHealthStatus, BudgetProgressMetrics } from '@ruma/types';
import { moneyToString } from './money';

/** ADR-011 thresholds: <80 on track, 80–100 warning, >100 over. */
export function budgetHealthStatus(percentage: number | null, spent: bigint): BudgetHealthStatus {
  if (percentage == null) {
    return spent > 0n ? 'OVER_BUDGET' : 'ON_TRACK';
  }
  if (percentage > 100) return 'OVER_BUDGET';
  if (percentage >= 80) return 'WARNING';
  return 'ON_TRACK';
}

/**
 * Compute progress metrics. Percentage uses one decimal place via integer math
 * (basis points / 10) so money stays in bigint until the final display ratio.
 */
export function computeProgress(budgetMinor: bigint, spentMinor: bigint): BudgetProgressMetrics {
  const remaining = budgetMinor - spentMinor;
  let percentage: number | null = null;
  if (budgetMinor > 0n) {
    // tenths of a percent: (spent * 1000) / budget → e.g. 305 = 30.5%
    const tenths = Number((spentMinor * 1000n) / budgetMinor);
    percentage = tenths / 10;
  }

  return {
    budgetMinor: moneyToString(budgetMinor),
    spentMinor: moneyToString(spentMinor),
    remainingMinor: moneyToString(remaining),
    percentage,
    status: budgetHealthStatus(percentage, spentMinor),
  };
}

export function shiftMonth(month: string, delta: number): string {
  const [yStr, mStr] = month.split('-');
  const date = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1, 12, 0, 0));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
