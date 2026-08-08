'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label, Select } from '@ruma/ui';
import type { FinancialAccountType } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import { createFinanceAccount, listFinanceAccounts, updateFinanceAccount } from '@/lib/api';
import { formatIdr, parseIdrInput } from '@/lib/money';

const ACCOUNT_TYPES: FinancialAccountType[] = ['BANK', 'CASH', 'E_WALLET', 'CREDIT_CARD', 'OTHER'];

export default function FinanceAccountsPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialAccountType>('BANK');
  const [initial, setInitial] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['finance-accounts', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceAccounts(accessToken!, familyId),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['finance-accounts', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-summary', familyId] });
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !name.trim()) return;
    const initialBalanceMinor = parseIdrInput(initial || '0');
    if (initialBalanceMinor == null) {
      setError('Enter a valid opening balance.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createFinanceAccount(accessToken, familyId, {
        name: name.trim(),
        type,
        initialBalanceMinor,
      });
      setName('');
      setInitial('');
      setType('BANK');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(accountId: string, isActive: boolean) {
    if (!accessToken) return;
    await updateFinanceAccount(accessToken, familyId, accountId, { isActive: !isActive });
    await refresh();
  }

  const accounts = accountsQuery.data?.accounts ?? [];

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="grid gap-1">
            <h1 className="m-0 text-3xl font-semibold tracking-tight">Accounts</h1>
            <p className="m-0 text-[var(--ruma-color-ink-muted)]">
              Places where the household keeps money.
            </p>
          </div>
          <FinanceSubnav familyId={familyId} />
        </header>

        <Card>
          <form className="grid gap-3" onSubmit={onCreate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="BCA Savings"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="account-type">Type</Label>
                <Select
                  id="account-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as FinancialAccountType)}
                >
                  {ACCOUNT_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item.replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5 sm:max-w-xs">
              <Label htmlFor="account-initial">Opening balance</Label>
              <Input
                id="account-initial"
                inputMode="numeric"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
                placeholder="10.000.000"
              />
            </div>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Add account'}
              </Button>
            </div>
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
          </form>
        </Card>

        {accountsQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <Card>
            <CardTitle>No accounts yet</CardTitle>
            <CardDescription>Start with a bank account or cash wallet.</CardDescription>
          </Card>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ruma-color-border)] pb-3"
              >
                <div>
                  <p className="m-0 font-medium">
                    {account.name}
                    {!account.isActive ? (
                      <span className="ml-2 text-xs text-[var(--ruma-color-ink-muted)]">
                        inactive
                      </span>
                    ) : null}
                  </p>
                  <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                    {account.type.replace('_', ' ')} · opening{' '}
                    {formatIdr(account.initialBalanceMinor)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="m-0 font-medium tabular-nums">{formatIdr(account.balanceMinor)}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleActive(account.id, account.isActive)}
                  >
                    {account.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
