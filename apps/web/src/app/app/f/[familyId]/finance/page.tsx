'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardDescription, CardTitle } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import { getFinanceSummary } from '@/lib/api';
import { currentMonth, formatIdr, monthLabel } from '@/lib/money';

export default function FinanceDashboardPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const month = currentMonth();

  const summaryQuery = useQuery({
    queryKey: ['finance-summary', familyId, month, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getFinanceSummary(accessToken!, familyId, month),
  });

  const summary = summaryQuery.data;

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h1 className="m-0 text-3xl font-semibold tracking-tight">Finance</h1>
              <p className="m-0 text-[var(--ruma-color-ink-muted)]">
                How is the household doing this month?
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
        </header>

        {summaryQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading finance…</p>
        ) : summaryQuery.isError ? (
          <p className="text-[var(--ruma-color-danger)]">Unable to load finance summary.</p>
        ) : summary ? (
          <>
            <section className="grid gap-1">
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                {monthLabel(summary.month)}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">Income</p>
                  <p className="m-0 text-2xl font-semibold tracking-tight">
                    {formatIdr(summary.incomeMinor)}
                  </p>
                </div>
                <div>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">Expenses</p>
                  <p className="m-0 text-2xl font-semibold tracking-tight">
                    {formatIdr(summary.expenseMinor)}
                  </p>
                </div>
                <div>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">Net cash flow</p>
                  <p className="m-0 text-2xl font-semibold tracking-tight">
                    {formatIdr(summary.netCashFlowMinor)}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              <h2 className="m-0 text-lg font-semibold">Accounts</h2>
              {summary.accounts.length === 0 ? (
                <Card>
                  <CardTitle>No accounts yet</CardTitle>
                  <CardDescription>
                    Add BCA, cash, or an e-wallet to start tracking.
                  </CardDescription>
                  <div className="mt-3">
                    <Link
                      href={`/app/f/${familyId}/finance/accounts`}
                      className="text-sm font-medium text-[var(--ruma-color-ink)]"
                    >
                      Add account
                    </Link>
                  </div>
                </Card>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {summary.accounts.map((account) => (
                    <li
                      key={account.id}
                      className="flex items-baseline justify-between gap-3 border-b border-[var(--ruma-color-border)] pb-3"
                    >
                      <div>
                        <p className="m-0 font-medium">{account.name}</p>
                        <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                          {account.type.replace('_', ' ')}
                        </p>
                      </div>
                      <p className="m-0 shrink-0 text-right font-medium tabular-nums">
                        {formatIdr(account.balanceMinor)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-3">
              <h2 className="m-0 text-lg font-semibold">Spending</h2>
              {summary.expensesByCategory.length === 0 ? (
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">No expenses this month.</p>
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {summary.expensesByCategory.map((row) => (
                    <li key={row.categoryId} className="flex justify-between gap-3 text-sm">
                      <span>{row.name}</span>
                      <span className="tabular-nums text-[var(--ruma-color-ink-muted)]">
                        {formatIdr(row.amountMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 text-lg font-semibold">Recent</h2>
                <Link
                  href={`/app/f/${familyId}/finance/transactions`}
                  className="text-sm text-[var(--ruma-color-ink-muted)]"
                >
                  See all
                </Link>
              </div>
              {summary.recentTransactions.length === 0 ? (
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">No transactions yet.</p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {summary.recentTransactions.map((txn) => {
                    const sign = txn.type === 'INCOME' ? '+' : txn.type === 'EXPENSE' ? '−' : '→';
                    const label =
                      txn.description ||
                      txn.category?.name ||
                      (txn.type === 'TRANSFER'
                        ? `${txn.account.name} → ${txn.transferAccount?.name ?? ''}`
                        : txn.type);
                    return (
                      <li
                        key={txn.id}
                        className="flex items-baseline justify-between gap-3 border-b border-[var(--ruma-color-border)] pb-3"
                      >
                        <div className="min-w-0">
                          <p className="m-0 truncate font-medium">{label}</p>
                          <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                            {txn.transactionDate}
                            {txn.category ? ` · ${txn.category.name}` : ''}
                            {` · ${txn.account.name}`}
                          </p>
                        </div>
                        <p className="m-0 shrink-0 tabular-nums">
                          {sign} {formatIdr(txn.amountMinor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
