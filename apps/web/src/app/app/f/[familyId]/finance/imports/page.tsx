'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Label, Select } from '@ruma/ui';
import type { ImportCandidateResponse, TransactionType } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import {
  confirmFinanceImport,
  connectSyntheticEmail,
  disconnectEmailConnection,
  ignoreFinanceImport,
  listEmailConnections,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceImports,
  syncEmailImports,
  updateFinanceImport,
} from '@/lib/api';
import { formatIdr } from '@/lib/money';

export default function FinanceImportsPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [lookbackDays, setLookbackDays] = useState<7 | 30 | 90>(30);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTransferAccountId, setEditTransferAccountId] = useState('');
  const [editType, setEditType] = useState<TransactionType>('EXPENSE');

  const connectionsQuery = useQuery({
    queryKey: ['email-connections', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listEmailConnections(accessToken!, familyId),
  });
  const importsQuery = useQuery({
    queryKey: ['finance-imports', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceImports(accessToken!, familyId),
  });
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

  const activeAccounts = useMemo(
    () => (accountsQuery.data?.accounts ?? []).filter((a) => a.isActive),
    [accountsQuery.data],
  );
  const connections = connectionsQuery.data?.connections ?? [];
  const activeConnection =
    connections.find((c) => c.status === 'CONNECTED') ?? connections[0] ?? null;
  const history = importsQuery.data?.history;
  const pendingCandidates = (importsQuery.data?.candidates ?? []).filter(
    (c) => c.status === 'PENDING_REVIEW',
  );
  const failedCandidates = (importsQuery.data?.candidates ?? []).filter(
    (c) => c.status === 'FAILED',
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['email-connections', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-imports', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-transactions', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-summary', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-analysis', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-accounts', familyId] });
  }

  async function onConnectDemo() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    setSyncMessage(null);
    try {
      await connectSyntheticEmail(accessToken, familyId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect');
    } finally {
      setPending(false);
    }
  }

  async function onDisconnect() {
    if (!accessToken || !activeConnection) return;
    setPending(true);
    setError(null);
    try {
      await disconnectEmailConnection(accessToken, familyId, activeConnection.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect');
    } finally {
      setPending(false);
    }
  }

  async function onSync() {
    if (!accessToken || !activeConnection || activeConnection.status !== 'CONNECTED') return;
    setPending(true);
    setError(null);
    setSyncMessage(null);
    try {
      const result = await syncEmailImports(
        accessToken,
        familyId,
        activeConnection.id,
        lookbackDays,
      );
      setSyncMessage(
        `Found ${result.messagesScanned} emails · ${result.candidatesCreated} new · ${result.alreadyProcessed} already processed`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setPending(false);
    }
  }

  function beginEdit(candidate: ImportCandidateResponse) {
    setEditingId(candidate.id);
    setEditType((candidate.transactionType as TransactionType) || 'EXPENSE');
    setEditAccountId(candidate.suggestedAccountId ?? '');
    setEditCategoryId(candidate.suggestedCategoryId ?? '');
    setEditTransferAccountId(candidate.suggestedTransferAccountId ?? '');
  }

  async function onSaveEdit(candidateId: string) {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      await updateFinanceImport(accessToken, familyId, candidateId, {
        transactionType: editType,
        accountId: editAccountId || null,
        categoryId: editType === 'TRANSFER' ? null : editCategoryId || null,
        transferAccountId: editType === 'TRANSFER' ? editTransferAccountId || null : null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update');
    } finally {
      setPending(false);
    }
  }

  async function onConfirm(candidate: ImportCandidateResponse) {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      const isEditing = editingId === candidate.id;
      await confirmFinanceImport(accessToken, familyId, candidate.id, {
        transactionType: isEditing
          ? editType
          : ((candidate.transactionType as TransactionType) ?? undefined),
        accountId: isEditing
          ? editAccountId || undefined
          : (candidate.suggestedAccountId ?? undefined),
        categoryId:
          (isEditing ? editType : candidate.transactionType) === 'TRANSFER'
            ? null
            : isEditing
              ? editCategoryId || null
              : (candidate.suggestedCategoryId ?? null),
        transferAccountId:
          (isEditing ? editType : candidate.transactionType) === 'TRANSFER'
            ? isEditing
              ? editTransferAccountId || undefined
              : (candidate.suggestedTransferAccountId ?? undefined)
            : undefined,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to confirm');
    } finally {
      setPending(false);
    }
  }

  async function onIgnore(candidateId: string) {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      await ignoreFinanceImport(accessToken, familyId, candidateId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to ignore');
    } finally {
      setPending(false);
    }
  }

  const categoriesForEdit = (categoriesQuery.data?.categories ?? []).filter(
    (c) => c.isActive && c.kind === editType,
  );

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="grid gap-1">
            <h1 className="m-0 text-3xl font-semibold tracking-tight">Imports</h1>
            <p className="m-0 text-[var(--ruma-color-ink-muted)]">
              Review transaction emails before they enter your household ledger.
            </p>
          </div>
          <FinanceSubnav familyId={familyId} />
        </header>

        <Card>
          <CardTitle>Email connection</CardTitle>
          <CardDescription>
            RUMA only uses transaction-related emails to help record household finances. Nothing is
            posted until you confirm.
          </CardDescription>
          <div className="mt-4 grid gap-3">
            {activeConnection ? (
              <div className="grid gap-1 text-sm">
                <p className="m-0 font-medium">
                  {activeConnection.provider === 'SYNTHETIC' ? 'Demo inbox' : 'Gmail'} ·{' '}
                  {activeConnection.emailAddress}
                </p>
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">
                  Status {activeConnection.status}
                  {activeConnection.lastSyncedAt
                    ? ` · Last synced ${new Date(activeConnection.lastSyncedAt).toLocaleString()}`
                    : ''}
                </p>
                {activeConnection.lastError ? (
                  <p className="m-0 text-[var(--ruma-color-danger)]">
                    {activeConnection.lastError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                No mailbox connected yet. Start with the demo inbox to try the review flow.
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              {!activeConnection || activeConnection.status !== 'CONNECTED' ? (
                <Button type="button" onClick={onConnectDemo} disabled={pending}>
                  Connect demo inbox
                </Button>
              ) : (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="lookback">Import from</Label>
                    <Select
                      id="lookback"
                      value={String(lookbackDays)}
                      onChange={(e) => setLookbackDays(Number(e.target.value) as 7 | 30 | 90)}
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                    </Select>
                  </div>
                  <Button type="button" onClick={onSync} disabled={pending}>
                    Sync transactions
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onDisconnect}
                    disabled={pending}
                  >
                    Disconnect
                  </Button>
                </>
              )}
            </div>
            {syncMessage ? (
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">{syncMessage}</p>
            ) : null}
          </div>
        </Card>

        {history ? (
          <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
            {history.confirmed} confirmed · {history.ignored} ignored · {history.pendingReview} need
            review · {history.failed} failed
          </p>
        ) : null}

        {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}

        <section className="grid gap-3">
          <h2 className="m-0 text-xl font-semibold tracking-tight">Needs review</h2>
          {pendingCandidates.length === 0 ? (
            <Card>
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                Nothing waiting. Sync your inbox when you are ready.
              </p>
            </Card>
          ) : (
            pendingCandidates.map((candidate) => (
              <Card key={candidate.id}>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="grid gap-1">
                      <p className="m-0 text-lg font-medium">
                        {candidate.merchant || candidate.description || 'Transaction'}
                      </p>
                      <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                        {candidate.parserProvider} · {candidate.transactionType ?? 'Unknown'} ·{' '}
                        {candidate.transactionDate ?? 'No date'} · {candidate.confidence}
                      </p>
                      {candidate.possibleDuplicateTransactionId ? (
                        <p className="m-0 text-sm text-[var(--ruma-color-warning,#a16207)]">
                          This may already exist in RUMA.
                        </p>
                      ) : null}
                      {candidate.transactionType === 'TRANSFER' &&
                      !candidate.suggestedTransferAccountId ? (
                        <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                          Transfer accounts need review before confirming.
                        </p>
                      ) : null}
                    </div>
                    <p className="m-0 text-xl font-semibold tabular-nums">
                      {candidate.amountMinor ? formatIdr(candidate.amountMinor) : '—'}
                    </p>
                  </div>

                  {editingId === candidate.id ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`type-${candidate.id}`}>Type</Label>
                        <Select
                          id={`type-${candidate.id}`}
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as TransactionType)}
                        >
                          <option value="EXPENSE">Expense</option>
                          <option value="INCOME">Income</option>
                          <option value="TRANSFER">Transfer</option>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`account-${candidate.id}`}>Account</Label>
                        <Select
                          id={`account-${candidate.id}`}
                          value={editAccountId}
                          onChange={(e) => setEditAccountId(e.target.value)}
                        >
                          <option value="">Select account</option>
                          {activeAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {editType === 'TRANSFER' ? (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`transfer-${candidate.id}`}>To account</Label>
                          <Select
                            id={`transfer-${candidate.id}`}
                            value={editTransferAccountId}
                            onChange={(e) => setEditTransferAccountId(e.target.value)}
                          >
                            <option value="">Select account</option>
                            {activeAccounts
                              .filter((a) => a.id !== editAccountId)
                              .map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.name}
                                </option>
                              ))}
                          </Select>
                        </div>
                      ) : (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`category-${candidate.id}`}>Category</Label>
                          <Select
                            id={`category-${candidate.id}`}
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                          >
                            <option value="">No category</option>
                            {categoriesForEdit.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                      Account hint: {candidate.accountHint ?? 'Needs review'}
                      {candidate.categoryHint ? ` · Category: ${candidate.categoryHint}` : ''}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => onConfirm(candidate)} disabled={pending}>
                      Confirm
                    </Button>
                    {editingId === candidate.id ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onSaveEdit(candidate.id)}
                        disabled={pending}
                      >
                        Save edits
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => beginEdit(candidate)}
                        disabled={pending}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onIgnore(candidate.id)}
                      disabled={pending}
                    >
                      Ignore
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </section>

        {failedCandidates.length > 0 ? (
          <section className="grid gap-3">
            <h2 className="m-0 text-xl font-semibold tracking-tight">Failed to parse</h2>
            {failedCandidates.map((candidate) => (
              <Card key={candidate.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="m-0 font-medium">{candidate.parserProvider}</p>
                    <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                      {candidate.parseError ?? 'Could not parse this email'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onIgnore(candidate.id)}
                    disabled={pending}
                  >
                    Dismiss
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
