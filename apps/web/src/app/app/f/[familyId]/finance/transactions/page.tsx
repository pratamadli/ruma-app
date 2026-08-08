'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import type { TransactionType } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceTransactions,
} from '@/lib/api';
import { formatIdr, parseIdrInput, todayDateOnly } from '@/lib/money';

export default function FinanceTransactionsPage() {
  return (
    <Suspense fallback={null}>
      <FinanceTransactionsInner />
    </Suspense>
  );
}

function FinanceTransactionsInner() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const searchParams = useSearchParams();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferAccountId, setTransferAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayDateOnly());
  const [filterType, setFilterType] = useState<'' | TransactionType>('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['finance-accounts', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceAccounts(accessToken!, familyId),
  });
  const categoriesQuery = useQuery({
    queryKey: ['finance-categories', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceCategories(accessToken!, familyId),
  });
  const transactionsQuery = useQuery({
    queryKey: [
      'finance-transactions',
      familyId,
      filterType,
      filterAccountId,
      filterCategoryId,
      q,
      accessToken,
    ],
    enabled: Boolean(accessToken && familyId),
    queryFn: () =>
      listFinanceTransactions(accessToken!, familyId, {
        type: filterType || undefined,
        accountId: filterAccountId || undefined,
        categoryId: filterCategoryId || undefined,
        q: q.trim() || undefined,
      }),
  });

  const activeAccounts = useMemo(
    () => (accountsQuery.data?.accounts ?? []).filter((a) => a.isActive),
    [accountsQuery.data],
  );
  const categories = useMemo(() => {
    const all = categoriesQuery.data?.categories ?? [];
    if (type === 'TRANSFER') return [];
    return all.filter((c) => c.isActive && c.kind === type);
  }, [categoriesQuery.data, type]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['finance-transactions', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-summary', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-accounts', familyId] });
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const amountMinor = parseIdrInput(amount);
    if (!amountMinor || amountMinor === '0') {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!accountId) {
      setError('Choose an account.');
      return;
    }
    if (type === 'TRANSFER' && !transferAccountId) {
      setError('Choose a destination account.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createFinanceTransaction(accessToken, familyId, {
        type,
        amountMinor,
        accountId,
        transferAccountId: type === 'TRANSFER' ? transferAccountId : undefined,
        categoryId: type === 'TRANSFER' ? null : categoryId || null,
        description: description.trim() || undefined,
        transactionDate,
      });
      setAmount('');
      setDescription('');
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save transaction');
    } finally {
      setPending(false);
    }
  }

  async function onDelete(transactionId: string) {
    if (!accessToken) return;
    if (!window.confirm('Remove this transaction from your history?')) return;
    await deleteFinanceTransaction(accessToken, familyId, transactionId);
    await refresh();
  }

  const transactions = transactionsQuery.data?.transactions ?? [];

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h1 className="m-0 text-3xl font-semibold tracking-tight">Transactions</h1>
              <p className="m-0 text-[var(--ruma-color-ink-muted)]">
                Quick entry for income, spending, and transfers.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close' : 'Add transaction'}
            </Button>
          </div>
          <FinanceSubnav familyId={familyId} />
        </header>

        {showForm ? (
          <Card>
            <form className="grid gap-3" onSubmit={onCreate}>
              <div className="grid grid-cols-3 gap-2">
                {(['EXPENSE', 'INCOME', 'TRANSFER'] as TransactionType[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={[
                      'rounded-[var(--ruma-radius-md)] border px-2 py-2 text-sm font-medium',
                      type === item
                        ? 'border-[var(--ruma-color-ink)] bg-[var(--ruma-color-ink)] text-[var(--ruma-color-surface)]'
                        : 'border-[var(--ruma-color-border)] bg-transparent text-[var(--ruma-color-ink-muted)]',
                    ].join(' ')}
                    onClick={() => {
                      setType(item);
                      setCategoryId('');
                    }}
                  >
                    {item === 'EXPENSE' ? 'Expense' : item === 'INCOME' ? 'Income' : 'Transfer'}
                  </button>
                ))}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="txn-amount">Amount</Label>
                <Input
                  id="txn-amount"
                  inputMode="numeric"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="125.000"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="txn-account">{type === 'TRANSFER' ? 'From' : 'Account'}</Label>
                  <Select
                    id="txn-account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {type === 'TRANSFER' ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="txn-to">To</Label>
                    <Select
                      id="txn-to"
                      value={transferAccountId}
                      onChange={(e) => setTransferAccountId(e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {activeAccounts
                        .filter((a) => a.id !== accountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label htmlFor="txn-category">Category</Label>
                    <Select
                      id="txn-category"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Optional</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="txn-date">Date</Label>
                  <Input
                    id="txn-date"
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="txn-note">Note</Label>
                  <Input
                    id="txn-note"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Dinner"
                  />
                </div>
              </div>

              <Button type="submit" disabled={pending || activeAccounts.length === 0}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
              {activeAccounts.length === 0 ? (
                <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                  Add an account first before recording transactions.
                </p>
              ) : null}
              {error ? (
                <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p>
              ) : null}
            </form>
          </Card>
        ) : null}

        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              aria-label="Filter type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as '' | TransactionType)}
            >
              <option value="">All types</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
            </Select>
            <Select
              aria-label="Filter account"
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
            >
              <option value="">All accounts</option>
              {(accountsQuery.data?.accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter category"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
            >
              <option value="">All categories</option>
              {(categoriesQuery.data?.categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes"
            />
          </div>
        </Card>

        {transactionsQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading transactions…</p>
        ) : transactions.length === 0 ? (
          <p className="m-0 text-[var(--ruma-color-ink-muted)]">No transactions match.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {transactions.map((txn) => {
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
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--ruma-color-border)] pb-3"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate font-medium">{label}</p>
                    <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                      {txn.transactionDate}
                      {txn.category ? ` · ${txn.category.name}` : ''}
                      {txn.type === 'TRANSFER'
                        ? ` · ${txn.account.name} → ${txn.transferAccount?.name ?? ''}`
                        : ` · ${txn.account.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="m-0 shrink-0 tabular-nums">
                      {sign} {formatIdr(txn.amountMinor)}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => void onDelete(txn.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
