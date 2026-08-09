'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label, Select } from '@ruma/ui';
import type { ImportCandidateResponse, TransactionType } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import {
  bulkIgnoreFinanceImports,
  confirmFinanceImport,
  connectSyntheticEmail,
  disconnectEmailConnection,
  getGmailAuthUrl,
  ignoreFinanceImport,
  listEmailConnections,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceImports,
  syncEmailImports,
  updateFinanceImport,
} from '@/lib/api';
import { GMAIL_OAUTH_FAMILY_KEY, GMAIL_OAUTH_STATE_KEY } from '@/lib/gmail-oauth';
import { formatIdr, parseIdrInput } from '@/lib/money';

type SyncPhase = 'idle' | 'syncing' | 'completed' | 'partial' | 'auth' | 'failed';

const SOURCE_LABELS: Record<string, string> = {
  SYNTHETIC_BANK: 'Demo bank',
  BCA: 'BCA',
  MANDIRI: 'Mandiri',
  GOPAY: 'GoPay',
};

export default function FinanceImportsPage() {
  return (
    <Suspense fallback={null}>
      <FinanceImportsInner />
    </Suspense>
  );
}

function FinanceImportsInner() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const searchParams = useSearchParams();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [lookbackDays, setLookbackDays] = useState<7 | 30 | 90>(30);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTransferAccountId, setEditTransferAccountId] = useState('');
  const [editType, setEditType] = useState<TransactionType>('EXPENSE');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

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

  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      setSyncMessage('Gmail connected. Choose a period and sync transaction emails.');
      setSyncPhase('idle');
    }
  }, [searchParams]);

  const activeAccounts = useMemo(
    () => (accountsQuery.data?.accounts ?? []).filter((a) => a.isActive),
    [accountsQuery.data],
  );
  const accountName = useMemo(() => {
    const map = new Map(activeAccounts.map((a) => [a.id, a.name]));
    return (id: string | null) => (id ? (map.get(id) ?? 'Needs review') : 'Needs review');
  }, [activeAccounts]);
  const categoryName = useMemo(() => {
    const map = new Map((categoriesQuery.data?.categories ?? []).map((c) => [c.id, c.name]));
    return (id: string | null, hint: string | null) =>
      (id ? map.get(id) : null) ?? hint ?? 'Needs review';
  }, [categoriesQuery.data]);

  const connections = connectionsQuery.data?.connections ?? [];
  const gmailConfigured = connectionsQuery.data?.gmailConfigured ?? false;
  const activeConnection =
    connections.find((c) => c.status === 'CONNECTED') ??
    connections.find((c) => c.status === 'ERROR') ??
    connections[0] ??
    null;
  const history = importsQuery.data?.history;
  const pendingCandidates = (importsQuery.data?.candidates ?? []).filter(
    (c) => c.status === 'PENDING_REVIEW',
  );
  const failedCandidates = (importsQuery.data?.candidates ?? []).filter(
    (c) => c.status === 'FAILED',
  );
  const selectedIds = pendingCandidates.filter((c) => selected[c.id]).map((c) => c.id);

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
    try {
      await connectSyntheticEmail(accessToken, familyId);
      await refresh();
      setSyncMessage('Demo inbox connected. Sync to load sample transaction emails.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect');
    } finally {
      setPending(false);
    }
  }

  async function onConnectGmail() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      const { url, state } = await getGmailAuthUrl(accessToken, familyId);
      sessionStorage.setItem(GMAIL_OAUTH_FAMILY_KEY, familyId);
      sessionStorage.setItem(GMAIL_OAUTH_STATE_KEY, state);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Gmail connection');
      setPending(false);
    }
  }

  async function onDisconnect() {
    if (!accessToken || !activeConnection) return;
    setPending(true);
    setError(null);
    try {
      await disconnectEmailConnection(accessToken, familyId, activeConnection.id);
      setSyncMessage(null);
      setSyncPhase('idle');
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
    setSyncPhase('syncing');
    setSyncMessage('Scanning transaction emails…');
    try {
      const result = await syncEmailImports(
        accessToken,
        familyId,
        activeConnection.id,
        lookbackDays,
      );
      const phase: SyncPhase =
        result.status === 'PARTIAL'
          ? 'partial'
          : result.candidatesCreated > 0 || result.alreadyProcessed > 0
            ? 'completed'
            : 'completed';
      setSyncPhase(phase);
      if (result.messagesScanned === 0) {
        setSyncMessage('No transaction emails found in this period.');
      } else {
        setSyncMessage(
          `Sync ${result.status === 'PARTIAL' ? 'partially completed' : 'completed'}. ${result.candidatesCreated} new need review · ${result.alreadyProcessed} already processed${result.parseFailures ? ` · ${result.parseFailures} failed to parse` : ''}${result.messageFetchFailures ? ` · ${result.messageFetchFailures} could not be read` : ''}.`,
        );
      }
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      setSyncPhase(/re-?author|auth|expired|reconnect/i.test(message) ? 'auth' : 'failed');
      setSyncMessage(null);
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
    setEditAmount(candidate.amountMinor ?? '');
    setEditDate(candidate.transactionDate ?? '');
    setEditDescription(candidate.description ?? candidate.merchant ?? '');
  }

  async function onSaveEdit(candidateId: string) {
    if (!accessToken) return;
    const amountMinor = editAmount ? parseIdrInput(editAmount) : null;
    if (editAmount && !amountMinor) {
      setError('Enter a valid amount.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateFinanceImport(accessToken, familyId, candidateId, {
        transactionType: editType,
        amountMinor: amountMinor ?? undefined,
        transactionDate: editDate || undefined,
        description: editDescription || null,
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
      const amountMinor = isEditing && editAmount ? parseIdrInput(editAmount) : undefined;
      await confirmFinanceImport(accessToken, familyId, candidate.id, {
        transactionType: isEditing
          ? editType
          : ((candidate.transactionType as TransactionType) ?? undefined),
        amountMinor: amountMinor ?? undefined,
        transactionDate: isEditing ? editDate || undefined : undefined,
        description: isEditing ? editDescription || null : undefined,
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

  async function onBulkIgnore() {
    if (!accessToken || selectedIds.length === 0) return;
    setPending(true);
    setError(null);
    try {
      await bulkIgnoreFinanceImports(accessToken, familyId, selectedIds);
      setSelected({});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to ignore selected');
    } finally {
      setPending(false);
    }
  }

  const categoriesForEdit = (categoriesQuery.data?.categories ?? []).filter(
    (c) => c.isActive && c.kind === editType,
  );

  const connected = activeConnection?.status === 'CONNECTED';
  const needsAuth = activeConnection?.status === 'ERROR' || syncPhase === 'auth';

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
            RUMA reads transaction-related emails to help record household finances. Nothing is
            posted until you confirm.
          </CardDescription>

          {showConsent ? (
            <div className="mt-4 grid gap-3 text-sm">
              <p className="m-0 font-medium">Before connecting Gmail</p>
              <ul className="m-0 grid list-disc gap-1 pl-5 text-[var(--ruma-color-ink-muted)]">
                <li>
                  Permission: read-only Gmail access (<code>gmail.readonly</code>)
                </li>
                <li>Why: find bank and payment notifications</li>
                <li>What RUMA stores: normalized transaction candidates — not full email bodies</li>
                <li>Not used for advertising, analytics, or unrelated features</li>
                <li>You can disconnect anytime; tokens are cleared locally</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void onConnectGmail()} disabled={pending}>
                  Continue to Google
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowConsent(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {activeConnection ? (
                <div className="grid gap-1 text-sm">
                  <p className="m-0 font-medium">
                    {activeConnection.provider === 'GMAIL' ? 'Gmail' : 'Demo inbox'} ·{' '}
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
                  Connect an email account to find transaction notifications.
                </p>
              )}

              <div className="flex flex-wrap items-end gap-3">
                {connected ? (
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
                    <Button type="button" onClick={() => void onSync()} disabled={pending}>
                      {syncPhase === 'syncing' ? 'Syncing…' : 'Sync now'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void onDisconnect()}
                      disabled={pending}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    {gmailConfigured ? (
                      <Button type="button" onClick={() => setShowConsent(true)} disabled={pending}>
                        {needsAuth ? 'Reconnect Gmail' : 'Connect Gmail'}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant={gmailConfigured ? 'secondary' : 'primary'}
                      onClick={() => void onConnectDemo()}
                      disabled={pending}
                    >
                      Connect demo inbox
                    </Button>
                    {activeConnection ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void onDisconnect()}
                        disabled={pending}
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
              {syncMessage ? (
                <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">{syncMessage}</p>
              ) : null}
            </div>
          )}
        </Card>

        {history ? (
          <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
            {history.confirmed} confirmed · {history.ignored} ignored · {history.pendingReview} need
            review · {history.failed} failed
          </p>
        ) : null}

        {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-xl font-semibold tracking-tight">Needs review</h2>
            {selectedIds.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void onBulkIgnore()}
                disabled={pending}
              >
                Ignore selected ({selectedIds.length})
              </Button>
            ) : null}
          </div>

          {!activeConnection ? (
            <Card>
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                Connect an email account to find transaction notifications.
              </p>
            </Card>
          ) : syncPhase === 'syncing' ? (
            <Card>
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                Syncing… this can take a moment for larger inboxes.
              </p>
            </Card>
          ) : pendingCandidates.length === 0 ? (
            <Card>
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                {activeConnection.lastSyncedAt
                  ? "You're all caught up."
                  : 'No transaction emails found yet. Sync when you are ready.'}
              </p>
            </Card>
          ) : (
            pendingCandidates.map((candidate) => (
              <Card key={candidate.id}>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(selected[candidate.id])}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [candidate.id]: e.target.checked }))
                        }
                      />
                      <span className="grid gap-1">
                        <span className="font-medium text-[var(--ruma-color-ink-muted)]">
                          {SOURCE_LABELS[candidate.parserProvider] ?? candidate.parserProvider}
                        </span>
                        <span className="text-lg font-medium text-[var(--ruma-color-ink)]">
                          {candidate.merchant || candidate.description || 'Transaction'}
                        </span>
                        <span className="text-[var(--ruma-color-ink-muted)]">
                          {formatType(candidate.transactionType)} ·{' '}
                          {candidate.transactionDate ?? 'No date'}
                        </span>
                      </span>
                    </label>
                    <p className="m-0 text-xl font-semibold tabular-nums">
                      {candidate.amountMinor ? formatIdr(candidate.amountMinor) : '—'}
                    </p>
                  </div>

                  {candidate.possibleDuplicateTransactionId ? (
                    <p className="m-0 text-sm text-[var(--ruma-color-warning,#a16207)]">
                      This may already exist in RUMA.
                    </p>
                  ) : null}
                  {candidate.transactionType === 'TRANSFER' &&
                  !candidate.suggestedTransferAccountId ? (
                    <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                      Transfer destination needs review.
                    </p>
                  ) : null}

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
                        <Label htmlFor={`amount-${candidate.id}`}>Amount</Label>
                        <Input
                          id={`amount-${candidate.id}`}
                          inputMode="numeric"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`date-${candidate.id}`}>Date</Label>
                        <Input
                          id={`date-${candidate.id}`}
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`desc-${candidate.id}`}>Description</Label>
                        <Input
                          id={`desc-${candidate.id}`}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
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
                      Account {accountName(candidate.suggestedAccountId)}
                      {candidate.transactionType !== 'TRANSFER'
                        ? ` · Category ${categoryName(candidate.suggestedCategoryId, candidate.categoryHint)}`
                        : ''}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void onConfirm(candidate)}
                      disabled={pending}
                    >
                      Confirm
                    </Button>
                    {editingId === candidate.id ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void onSaveEdit(candidate.id)}
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
                      onClick={() => void onIgnore(candidate.id)}
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
            <h2 className="m-0 text-xl font-semibold tracking-tight">Couldn’t read</h2>
            {failedCandidates.map((candidate) => (
              <Card key={candidate.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="m-0 font-medium">
                      {SOURCE_LABELS[candidate.parserProvider] ?? candidate.parserProvider}
                    </p>
                    <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                      {candidate.parseError ?? 'Could not parse this email'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onIgnore(candidate.id)}
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

function formatType(type: string | null) {
  if (type === 'INCOME') return 'Income';
  if (type === 'TRANSFER') return 'Transfer';
  if (type === 'EXPENSE') return 'Expense';
  return 'Unknown';
}
