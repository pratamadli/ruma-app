'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardDescription, CardTitle } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { BudgetProgressRow } from '@/components/budget-progress';
import { FinanceSubnav } from '@/components/finance-subnav';
import { FinanceScopePicker, useFinanceScope } from '@/components/finance-scope';
import { useAuth } from '@/lib/auth-context';
import {
  getFinanceAnalysis,
  getFinanceSummary,
  listFinanceGoals,
  listFinanceSchedules,
  listInvestments,
} from '@/lib/api';
import { currentMonth, formatIdr, formatPercent, monthLabel, shiftMonth } from '@/lib/money';

export default function FinanceDashboardPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const { scope } = useFinanceScope();
  const [month, setMonth] = useState(currentMonth());

  const analysisQuery = useQuery({
    queryKey: ['finance-analysis', familyId, month, accessToken, scope],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getFinanceAnalysis(accessToken!, familyId, { month, months: 6, scope }),
  });
  const summaryQuery = useQuery({
    queryKey: ['finance-summary', familyId, month, accessToken, scope],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getFinanceSummary(accessToken!, familyId, month, scope),
  });

  const goalsQuery = useQuery({
    queryKey: ['finance-goals', familyId, accessToken, scope],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceGoals(accessToken!, familyId, scope),
  });
  const schedulesQuery = useQuery({
    queryKey: ['finance-schedules', familyId, accessToken, scope],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceSchedules(accessToken!, familyId, scope),
  });
  const investmentsQuery = useQuery({
    queryKey: ['finance-investments', familyId, accessToken, scope],
    enabled: Boolean(accessToken),
    queryFn: () => listInvestments(accessToken!, familyId, scope),
  });
  const analysis = analysisQuery.data;
  const budget = analysis?.budget ?? null;
  const expenseChange = analysis?.comparison.expenses;
  const activeGoals = goalsQuery.data?.goals.filter((goal) => goal.status === 'ACTIVE');
  const upcoming = schedulesQuery.data?.schedules
    .filter(
      (schedule) =>
        schedule.enabled &&
        (schedule.kind === 'MONTHLY_REPORT' ||
          (schedule.dueAt && new Date(schedule.dueAt) >= new Date())),
    )
    .slice(0, 5);

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h1 className="m-0 text-3xl font-semibold tracking-tight">Finance</h1>
              <p className="m-0 text-[var(--ruma-color-ink-muted)]">
                Understand where your {scope === 'PERSONAL' ? 'personal' : 'household'} money went.
              </p>
            </div>
            <Link
              href={`/app/f/${familyId}/finance/transactions?new=1`}
              className="inline-flex items-center justify-center rounded-[var(--ruma-radius-md)] bg-[var(--ruma-color-ink)] px-3 py-2 text-xs font-semibold text-[var(--ruma-color-surface)] no-underline"
            >
              Add transaction
            </Link>
          </div>
          <FinanceSubnav familyId={familyId} />
          <FinanceScopePicker />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-1.5 text-sm"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="m-0 text-sm font-medium">{monthLabel(month)}</p>
            <button
              type="button"
              className="rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-1.5 text-sm"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </header>

        {summaryQuery.isError ? <p role="alert">{summaryQuery.error.message}</p> : null}
        {summaryQuery.data ? (
          <section className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardTitle>Accounts</CardTitle>
              {summaryQuery.data.accounts.length === 0 ? (
                <p>No accounts in this scope yet.</p>
              ) : (
                summaryQuery.data.accounts.map((account) => (
                  <p key={account.id} className="flex justify-between gap-3">
                    <span>{account.name}</span>
                    <span>{formatIdr(account.balanceMinor)}</span>
                  </p>
                ))
              )}
            </Card>
            <Card>
              <CardTitle>Investment movements</CardTitle>
              <p>Contributions: {formatIdr(summaryQuery.data.investmentBuyMinor)}</p>
              <p>Withdrawals: {formatIdr(summaryQuery.data.investmentSellMinor)}</p>
              <p>Dividends: {formatIdr(summaryQuery.data.dividendMinor)}</p>
              <p>Investment fees: {formatIdr(summaryQuery.data.investmentFeesMinor)}</p>
              {investmentsQuery.data ? (
                <p>
                  Latest manual valuations: {formatIdr(investmentsQuery.data.totalValuationMinor)}
                </p>
              ) : null}
              <CardDescription>
                Separate from ordinary income and consumption expenses.
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>Recent transactions</CardTitle>
              {summaryQuery.data.recentTransactions.length === 0 ? (
                <p>No transactions yet.</p>
              ) : (
                summaryQuery.data.recentTransactions.map((txn) => (
                  <p key={txn.id} className="flex justify-between gap-3">
                    <span>
                      {txn.description ?? txn.type} · {txn.transactionDate}
                    </span>
                    <span>{formatIdr(txn.amountMinor)}</span>
                  </p>
                ))
              )}
            </Card>
            <Card>
              <CardTitle>Savings goals</CardTitle>
              {goalsQuery.isLoading ? <p>Loading goals...</p> : null}
              {activeGoals?.map((goal) => (
                <p key={goal.id}>
                  {goal.name}: {formatIdr(goal.currentAmountMinor)} /{' '}
                  {formatIdr(goal.targetAmountMinor)}
                </p>
              ))}
              {activeGoals?.length === 0 ? <p>No active goals in this scope yet.</p> : null}
            </Card>
            <Card>
              <CardTitle>Upcoming reminders</CardTitle>
              {schedulesQuery.isLoading ? <p>Loading reminders...</p> : null}
              {upcoming?.map((schedule) => (
                <p key={schedule.id}>
                  {schedule.title} ·{' '}
                  {schedule.kind === 'MONTHLY_REPORT'
                    ? 'Monthly report'
                    : new Date(schedule.dueAt!).toLocaleDateString()}
                </p>
              ))}
              {upcoming?.length === 0 ? <p>No upcoming reminders.</p> : null}
            </Card>
          </section>
        ) : null}
        {goalsQuery.isError || schedulesQuery.isError || investmentsQuery.isError ? (
          <p role="alert">Unable to load goals, reminders or valuations. Please retry.</p>
        ) : null}

        {analysisQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading finance…</p>
        ) : analysisQuery.isError ? (
          <p className="text-[var(--ruma-color-danger)]">Unable to load finance analysis.</p>
        ) : analysis ? (
          <>
            <section className="grid gap-1">
              <h2 className="m-0 text-lg font-semibold">Cash flow</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">Income</p>
                  <p className="m-0 text-2xl font-semibold tracking-tight">
                    {formatIdr(analysis.summary.incomeMinor)}
                  </p>
                </div>
                <div>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">Expenses</p>
                  <p className="m-0 text-2xl font-semibold tracking-tight">
                    {formatIdr(analysis.summary.expenseMinor)}
                  </p>
                  {expenseChange && analysis.monthsWithData >= 2 ? (
                    <p className="m-0 mt-1 text-sm text-[var(--ruma-color-ink-muted)]">
                      {expenseChange.percentageChange == null
                        ? `Compared with ${monthLabel(analysis.comparison.previousMonth)}`
                        : `${expenseChange.percentageChange > 0 ? '↑' : expenseChange.percentageChange < 0 ? '↓' : '→'} ${formatPercent(Math.abs(expenseChange.percentageChange))} vs ${monthLabel(analysis.comparison.previousMonth)}`}
                    </p>
                  ) : (
                    <p className="m-0 mt-1 text-sm text-[var(--ruma-color-ink-muted)]">
                      Keep adding months to unlock comparisons.
                    </p>
                  )}
                </div>
                <div>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">Net cash flow</p>
                  <p className="m-0 text-2xl font-semibold tracking-tight">
                    {formatIdr(analysis.summary.netCashFlowMinor)}
                  </p>
                </div>
              </div>
            </section>

            {budget?.household ? (
              <section className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-lg font-semibold">Budget</h2>
                  <Link
                    href={`/app/f/${familyId}/finance/budgets`}
                    className="text-sm text-[var(--ruma-color-ink-muted)]"
                  >
                    Manage
                  </Link>
                </div>
                <BudgetProgressRow
                  title={scope === 'PERSONAL' ? 'Personal' : 'Household'}
                  budgetMinor={budget.household.budgetMinor}
                  spentMinor={budget.household.spentMinor}
                  remainingMinor={budget.household.remainingMinor}
                  percentage={budget.household.percentage}
                  status={budget.household.status}
                />
              </section>
            ) : (
              <Card>
                <CardTitle>No budget for {monthLabel(month)}</CardTitle>
                <CardDescription>
                  Set a light spending plan so progress shows up here.
                </CardDescription>
                <div className="mt-3">
                  <Link
                    href={`/app/f/${familyId}/finance/budgets`}
                    className="text-sm font-medium text-[var(--ruma-color-ink)]"
                  >
                    Create budget
                  </Link>
                </div>
              </Card>
            )}

            <section className="grid gap-3">
              <h2 className="m-0 text-lg font-semibold">Where your money went</h2>
              {analysis.topCategories.length === 0 ? (
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">No expenses this month.</p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {analysis.topCategories.slice(0, 6).map((row) => (
                    <li key={row.categoryId} className="grid gap-1">
                      <div className="flex justify-between gap-3 text-sm">
                        <span>{row.name}</span>
                        <span className="tabular-nums text-[var(--ruma-color-ink-muted)]">
                          {formatIdr(row.amountMinor)}
                          {row.percentageOfExpenses != null
                            ? ` · ${formatPercent(row.percentageOfExpenses)}`
                            : ''}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className="h-full rounded-full bg-[var(--ruma-color-ink)]"
                          style={{
                            width: `${Math.min(row.percentageOfExpenses ?? 0, 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-3">
              <h2 className="m-0 text-lg font-semibold">Things worth noticing</h2>
              {analysis.insights.length === 0 ? (
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">Nothing unusual right now.</p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {analysis.insights.map((insight, index) => (
                    <li
                      key={`${insight.type}-${index}`}
                      className="border-b border-[var(--ruma-color-border)] pb-3"
                    >
                      <p className="m-0 font-medium">{insight.title}</p>
                      <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                        {insight.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-3">
              <h2 className="m-0 text-lg font-semibold">Spending trend</h2>
              {analysis.monthsWithData < 2 ? (
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">
                  Keep adding transactions to unlock spending trends.
                </p>
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {analysis.trend.map((point) => {
                    const max = analysis.trend.reduce(
                      (acc, p) => (BigInt(p.expenseMinor) > acc ? BigInt(p.expenseMinor) : acc),
                      0n,
                    );
                    const width =
                      max === 0n ? 0 : Number((BigInt(point.expenseMinor) * 100n) / max);
                    return (
                      <li
                        key={point.month}
                        className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm"
                      >
                        <span className="text-[var(--ruma-color-ink-muted)]">
                          {monthLabel(point.month).split(' ')[0]}
                        </span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                          <div
                            className="h-full rounded-full bg-[var(--ruma-color-ink)]/80"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-[var(--ruma-color-ink-muted)]">
                          {formatIdr(point.expenseMinor)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {analysis.recurring.length > 0 ? (
              <section className="grid gap-3">
                <h2 className="m-0 text-lg font-semibold">Likely recurring</h2>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {analysis.recurring.slice(0, 5).map((pattern) => (
                    <li
                      key={`${pattern.label}-${pattern.categoryId}`}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>
                        {pattern.label}
                        {pattern.categoryName ? (
                          <span className="text-[var(--ruma-color-ink-muted)]">
                            {' '}
                            · {pattern.categoryName}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-[var(--ruma-color-ink-muted)]">
                        ~{formatIdr(pattern.typicalAmountMinor)}/mo
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
