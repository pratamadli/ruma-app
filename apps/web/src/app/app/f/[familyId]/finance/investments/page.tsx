'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { FinanceScopePicker, useFinanceScope } from '@/components/finance-scope';
import { useAuth } from '@/lib/auth-context';
import {
  createInvestmentPosition,
  listFinanceAccounts,
  listInvestments,
  updateInvestmentPosition,
  valueInvestment,
} from '@/lib/api';
import { formatIdr, parseIdrInput, todayDateOnly } from '@/lib/money';

export default function InvestmentsPage() {
  const { familyId } = useParams<{ familyId: string }>(),
    { accessToken } = useAuth(),
    { scope } = useFinanceScope();
  const client = useQueryClient();
  const [name, setName] = useState(''),
    [accountId, setAccountId] = useState(''),
    [assetType, setAssetType] = useState('FUND'),
    [units, setUnits] = useState('1');
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const [valuationId, setValuationId] = useState(''),
    [value, setValue] = useState(''),
    [date, setDate] = useState(todayDateOnly());
  const positions = useQuery({
    queryKey: ['finance-investments', familyId, accessToken, scope],
    enabled: Boolean(accessToken),
    queryFn: () => listInvestments(accessToken!, familyId, scope),
  });
  const accounts = useQuery({
    queryKey: ['finance-accounts', familyId, accessToken, scope],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceAccounts(accessToken!, familyId, scope),
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setPending(true);
    setError('');
    try {
      await createInvestmentPosition(accessToken, familyId, {
        scope,
        accountId,
        instrumentName: name,
        assetType,
        unitsDecimal: units,
      });
      setName('');
      await client.invalidateQueries({ queryKey: ['finance-investments', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save position');
    } finally {
      setPending(false);
    }
  }
  async function valuation(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const valueMinor = parseIdrInput(value);
    if (valueMinor == null) {
      setError('Enter a valid valuation.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await valueInvestment(accessToken, familyId, valuationId, {
        valuationDate: date,
        valueMinor,
      });
      setValuationId('');
      await client.invalidateQueries({ queryKey: ['finance-investments', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save valuation');
    } finally {
      setPending(false);
    }
  }
  async function edit(id: string, currentUnits: string) {
    if (!accessToken) return;
    const unitsDecimal = window.prompt(
      'Current quantity (manual snapshot, up to 8 decimals)',
      currentUnits,
    );
    if (!unitsDecimal) return;
    try {
      await updateInvestmentPosition(accessToken, familyId, id, { unitsDecimal });
      await client.invalidateQueries({ queryKey: ['finance-investments', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update position');
    }
  }
  async function archive(id: string, active: boolean) {
    if (
      !accessToken ||
      !window.confirm(
        active
          ? 'Archive this position? Valuation history is preserved.'
          : 'Restore this position?',
      )
    )
      return;
    try {
      await updateInvestmentPosition(accessToken, familyId, id, { isActive: !active });
      await client.invalidateQueries({ queryKey: ['finance-investments', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update position');
    }
  }
  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <h1 className="text-3xl font-semibold">Investments</h1>
          <FinanceSubnav familyId={familyId} />
          <FinanceScopePicker
            onChange={() => {
              setAccountId('');
              setValuationId('');
            }}
          />
        </header>
        {positions.data ? (
          <p>
            Latest manually valued holdings: {formatIdr(positions.data.totalValuationMinor)}.
            Unvalued positions are not included.
          </p>
        ) : null}
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="position-name">Instrument</Label>
              <Input
                id="position-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="position-account">Investment account / platform</Label>
              <Select
                id="position-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                <option value="">Choose account</option>
                {accounts.data?.accounts
                  .filter((a) => a.type === 'INVESTMENT' && a.isActive)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="position-type">Asset type</Label>
              <Select
                id="position-type"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                {['STOCK', 'FUND', 'BOND', 'GOLD', 'CRYPTO', 'OTHER'].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="position-units">Quantity (manual)</Label>
              <Input
                id="position-units"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                required
              />
            </div>
            <Button disabled={pending}>Add holding</Button>
          </form>
          <p className="text-sm">
            Record cash contributions/withdrawals once as investment buys/sells in Transactions.
            Holdings and valuations do not create additional expenses.
          </p>
        </Card>
        {error || positions.isError || accounts.isError ? (
          <p role="alert">{error || 'Unable to load investment data.'}</p>
        ) : null}
        {positions.isLoading ? (
          <p>Loading holdings...</p>
        ) : positions.data?.positions.length === 0 ? (
          <p>No holdings in this scope yet.</p>
        ) : (
          positions.data?.positions.map((position) => (
            <Card key={position.id}>
              <h2 className="text-lg font-semibold">
                {position.instrumentName} · {position.assetType}
              </h2>
              <p>
                {position.unitsDecimal} units ·{' '}
                {position.valueMinor == null
                  ? 'Not valued'
                  : `${formatIdr(position.valueMinor)} as of ${position.valuationDate}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setValuationId(position.id);
                    setValue(position.valueMinor ?? '');
                  }}
                >
                  Add valuation
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void edit(position.id, position.unitsDecimal)}
                >
                  Update quantity
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void archive(position.id, position.isActive)}
                >
                  {position.isActive ? 'Archive' : 'Restore'}
                </Button>
              </div>
              {valuationId === position.id ? (
                <form onSubmit={valuation} className="mt-3 grid gap-3">
                  <Label htmlFor="valuation-value">Value in IDR</Label>
                  <Input
                    id="valuation-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                  <Label htmlFor="valuation-date">Valuation date</Label>
                  <Input
                    id="valuation-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                  <Button disabled={pending}>Save snapshot</Button>
                </form>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
