'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import type { TransactionResponse, TransactionType } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { FinanceScopePicker, useFinanceScope } from '@/components/finance-scope';
import { useAuth } from '@/lib/auth-context';
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceTransactions,
  updateFinanceTransaction,
  getFinanceTransaction,
  downloadFinanceReceipt,
  listMembers,
} from '@/lib/api';
import { formatIdr, parseIdrInput, todayDateOnly } from '@/lib/money';

const TRANSACTION_TYPES: TransactionType[] = [
  'EXPENSE',
  'INCOME',
  'TRANSFER',
  'INVESTMENT_BUY',
  'INVESTMENT_SELL',
  'DIVIDEND',
  'BALANCE_ADJUSTMENT',
];

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
  const { scope } = useFinanceScope();
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payerUserId, setPayerUserId] = useState('');
  const [filterPayer, setFilterPayer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const requestKey = useRef<string | null>(null);
  const [instrument, setInstrument] = useState(''),
    [units, setUnits] = useState(''),
    [unitPrice, setUnitPrice] = useState(''),
    [fees, setFees] = useState('0');
  const trade = type === 'INVESTMENT_BUY' || type === 'INVESTMENT_SELL';
  const movement = ['TRANSFER', 'INVESTMENT_BUY', 'INVESTMENT_SELL'].includes(type);

  const membersQuery = useQuery({
    queryKey: ['family-members', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listMembers(accessToken!, familyId),
  });

  const accountsQuery = useQuery({
    queryKey: ['finance-accounts', familyId, accessToken, scope],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceAccounts(accessToken!, familyId, scope),
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
      scope,
      offset,
      from,
      to,
      filterPayer,
    ],
    enabled: Boolean(accessToken && familyId),
    queryFn: () =>
      listFinanceTransactions(accessToken!, familyId, {
        scope,
        offset,
        limit: 25,
        from: from || undefined,
        to: to || undefined,
        payerUserId: filterPayer || undefined,
        type: filterType || undefined,
        accountId: filterAccountId || undefined,
        categoryId: filterCategoryId || undefined,
        q: q.trim() || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['finance-transaction', familyId, editingId, accessToken, scope],
    enabled: Boolean(accessToken && editingId),
    queryFn: () => getFinanceTransaction(accessToken!, familyId, editingId!),
  });

  const activeAccounts = useMemo(
    () => (accountsQuery.data?.accounts ?? []).filter((a) => a.isActive),
    [accountsQuery.data],
  );
  const categories = useMemo(() => {
    const all = categoriesQuery.data?.categories ?? [];
    if (type === 'TRANSFER') return [];
    const kind = ['INVESTMENT_BUY', 'INVESTMENT_SELL', 'DIVIDEND'].includes(type)
      ? 'INVESTMENT'
      : type;
    return all.filter((c) => c.isActive && c.kind === kind);
  }, [categoriesQuery.data, type]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['finance-transactions', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-summary', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-accounts', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-analysis', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-budget', familyId] });
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
    if (movement && !transferAccountId) {
      setError('Choose a destination account.');
      return;
    }
    if (
      !window.confirm(
        `${editingId ? 'Update' : 'Save'} ${scope.toLowerCase()} ${type.toLowerCase().replaceAll('_', ' ')} of ${formatIdr(amountMinor)}?`,
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      const input = {
        type,
        ...(trade
          ? {
              instrumentName: instrument || undefined,
              unitsDecimal: units || undefined,
              unitPriceMinor: unitPrice ? (parseIdrInput(unitPrice) ?? unitPrice) : undefined,
              feesMinor: parseIdrInput(fees) ?? fees,
            }
          : {}),
        amountMinor,
        accountId,
        transferAccountId: movement ? transferAccountId : undefined,
        categoryId: type === 'TRANSFER' ? null : categoryId || null,
        description: description.trim() || undefined,
        transactionDate,
        payerUserId: scope === 'HOUSEHOLD' ? payerUserId || undefined : undefined,
        adjustmentDirection: type === 'BALANCE_ADJUSTMENT' ? direction : undefined,
      };
      if (editingId) await updateFinanceTransaction(accessToken, familyId, editingId, input);
      else {
        requestKey.current ??= crypto.randomUUID();
        await createFinanceTransaction(accessToken, familyId, {
          ...input,
          scope,
          idempotencyKey: requestKey.current,
        });
      }
      requestKey.current = null;
      setEditingId(null);
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
    try {
      await deleteFinanceTransaction(accessToken, familyId, transactionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to void transaction');
    }
  }

  function edit(txn: TransactionResponse) {
    setEditingId(txn.id);
    setType(txn.type);
    setAmount(txn.amountMinor);
    setAccountId(txn.account.id);
    setTransferAccountId(txn.transferAccount?.id ?? '');
    setCategoryId(txn.category?.id ?? '');
    setDescription(txn.description ?? '');
    setTransactionDate(txn.transactionDate);
    setPayerUserId(txn.payerUserId ?? '');
    setDirection(txn.adjustmentDirection === 'DECREASE' ? 'DECREASE' : 'INCREASE');
    setInstrument(txn.instrumentName ?? '');
    setUnits(txn.unitsDecimal ?? '');
    setUnitPrice(txn.unitPriceMinor ?? '');
    setFees(txn.feesMinor);
    setShowForm(true);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setType('EXPENSE');
    setAmount('');
    setDescription('');
    setAccountId('');
    setTransferAccountId('');
    setCategoryId('');
    setPayerUserId('');
    setTransactionDate(todayDateOnly());
    setDirection('INCREASE');
    setInstrument('');
    setUnits('');
    setUnitPrice('');
    setFees('0');
    setError(null);
    requestKey.current = null;
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
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                setShowForm((v) => !v);
                resetForm();
              }}
            >
              {showForm ? 'Close' : 'Add transaction'}
            </Button>
          </div>
          <FinanceSubnav familyId={familyId} />
          <FinanceScopePicker
            onChange={() => {
              resetForm();
              setFilterAccountId('');
              setFilterPayer('');
              setOffset(0);
              setShowForm(false);
            }}
          />
        </header>
        {error ? (
          <p role="alert" className="text-[var(--ruma-color-danger)]">
            {error}
          </p>
        ) : null}
        {accountsQuery.isError || categoriesQuery.isError || membersQuery.isError ? (
          <p role="alert">Unable to load transaction form options. Please retry.</p>
        ) : null}

        {showForm ? (
          <Card>
            <form className="grid gap-3" onSubmit={onCreate}>
              {editingId && detailQuery.isLoading ? <p>Loading attachments...</p> : null}
              {editingId && detailQuery.isError ? (
                <p role="alert">Unable to load transaction attachments.</p>
              ) : null}
              {detailQuery.data?.receiptIds.map((id) => (
                <Button
                  key={id}
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (accessToken)
                      void downloadFinanceReceipt(accessToken, familyId, id).catch((err: unknown) =>
                        setError(
                          err instanceof Error ? err.message : 'Unable to download receipt.',
                        ),
                      );
                  }}
                >
                  Download receipt
                </Button>
              ))}
              <div className="grid grid-cols-3 gap-2">
                {TRANSACTION_TYPES.map((item) => (
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
                    {item.replaceAll('_', ' ').toLowerCase()}
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
                  <Label htmlFor="txn-account">{movement ? 'From' : 'Account'}</Label>
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
                {movement ? (
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

              {scope === 'HOUSEHOLD' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="txn-payer">{type === 'INCOME' ? 'Recipient' : 'Paid by'}</Label>
                  <Select
                    id="txn-payer"
                    value={payerUserId}
                    onChange={(e) => setPayerUserId(e.target.value)}
                  >
                    <option value="">You</option>
                    {membersQuery.data?.members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name ?? member.email}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {type === 'BALANCE_ADJUSTMENT' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="txn-direction">Adjustment direction</Label>
                  <Select
                    id="txn-direction"
                    value={direction}
                    onChange={(e) =>
                      setDirection(e.target.value === 'DECREASE' ? 'DECREASE' : 'INCREASE')
                    }
                  >
                    <option value="INCREASE">Increase</option>
                    <option value="DECREASE">Decrease</option>
                  </Select>
                </div>
              ) : null}
              {trade ? (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend>Trade details (principal excludes fees)</legend>
                  <div>
                    <Label htmlFor="trade-instrument">Instrument (optional)</Label>
                    <Input
                      id="trade-instrument"
                      value={instrument}
                      onChange={(e) => setInstrument(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trade-units">Quantity (optional, up to 8 decimals)</Label>
                    <Input
                      id="trade-units"
                      value={units}
                      onChange={(e) => setUnits(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trade-price">Unit price in IDR</Label>
                    <Input
                      id="trade-price"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      required={Boolean(units)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trade-fees">Investment fees in IDR</Label>
                    <Input id="trade-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
                  </div>
                </fieldset>
              ) : null}
              <Button type="submit" disabled={pending || activeAccounts.length === 0}>
                {pending ? 'Saving…' : editingId ? 'Save changes' : 'Save'}
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
              onChange={(e) => {
                setFilterType(e.target.value as '' | TransactionType);
                setOffset(0);
              }}
            >
              <option value="">All types</option>
              {TRANSACTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter account"
              value={filterAccountId}
              onChange={(e) => {
                setFilterAccountId(e.target.value);
                setOffset(0);
              }}
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
              onChange={(e) => {
                setFilterCategoryId(e.target.value);
                setOffset(0);
              }}
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
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              placeholder="Search notes"
            />
            <Input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setOffset(0);
              }}
            />
            <Input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
            />
            {scope === 'HOUSEHOLD' ? (
              <Select
                aria-label="Filter payer"
                value={filterPayer}
                onChange={(e) => {
                  setFilterPayer(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All payers</option>
                {membersQuery.data?.members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name ?? member.email}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        </Card>

        {transactionsQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading transactions…</p>
        ) : transactionsQuery.isError ? (
          <p role="alert" className="text-[var(--ruma-color-danger)]">
            {transactionsQuery.error.message}
          </p>
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
                      {txn.scope === 'PERSONAL'
                        ? 'Personal · '
                        : `Household · ${membersQuery.data?.members.find((m) => m.userId === txn.payerUserId)?.name ?? 'Member'} · `}
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
                    <Button size="sm" variant="ghost" onClick={() => edit(txn)}>
                      Edit / details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void onDelete(txn.id)}>
                      Void
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-2" aria-label="Transaction pages">
          <Button
            variant="ghost"
            disabled={offset === 0 || transactionsQuery.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={transactionsQuery.data?.nextOffset == null || transactionsQuery.isFetching}
            onClick={() => setOffset(transactionsQuery.data?.nextOffset ?? offset)}
          >
            Next
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
