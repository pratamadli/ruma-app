'use client';

import type { BudgetHealthStatus } from '@ruma/types';
import { formatIdr, formatPercent } from '@/lib/money';

function barClass(status: BudgetHealthStatus) {
  if (status === 'OVER_BUDGET') return 'bg-[var(--ruma-color-danger)]';
  if (status === 'WARNING') return 'bg-[color-mix(in_srgb,var(--ruma-color-ink)_70%,transparent)]';
  return 'bg-[var(--ruma-color-ink)]';
}

export function BudgetProgressRow({
  title,
  budgetMinor,
  spentMinor,
  remainingMinor,
  percentage,
  status,
  compact,
}: {
  title: string;
  budgetMinor: string;
  spentMinor: string;
  remainingMinor: string;
  percentage: number | null;
  status: BudgetHealthStatus;
  compact?: boolean;
}) {
  const width = percentage == null ? 0 : Math.min(percentage, 100);
  const over = remainingMinor.startsWith('-');

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`m-0 ${compact ? 'text-sm font-medium' : 'font-medium'}`}>{title}</p>
        <p className="m-0 shrink-0 text-sm tabular-nums text-[var(--ruma-color-ink-muted)]">
          {formatIdr(spentMinor)} / {formatIdr(budgetMinor)}
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]"
        role="progressbar"
        aria-valuenow={percentage ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} budget progress`}
      >
        <div className={`h-full rounded-full ${barClass(status)}`} style={{ width: `${width}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-xs text-[var(--ruma-color-ink-muted)]">
        <span>
          {over
            ? `Over by ${formatIdr(remainingMinor.slice(1))}`
            : `${formatIdr(remainingMinor)} remaining`}
        </span>
        <span className="tabular-nums">{formatPercent(percentage)}</span>
      </div>
    </div>
  );
}
