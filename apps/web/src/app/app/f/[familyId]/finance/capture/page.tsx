'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import type { FinanceDraftResponse } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import {
  cancelFinanceDraft,
  confirmFinanceDraft,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceDrafts,
  replaceFinanceDraft,
} from '@/lib/api';
import { formatIdr, parseIdrInput } from '@/lib/money';
import { ReceiptCapture } from '@/components/receipt-capture';
import { TelegramConnect } from '@/components/telegram-connect';

export default function CapturePage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { accessToken } = useAuth();
  const drafts = useQuery({
    queryKey: ['finance-drafts', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceDrafts(accessToken!, familyId),
  });
  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <h1 className="text-3xl font-semibold">Assisted capture</h1>
          <FinanceSubnav familyId={familyId} />
        </header>
        <TelegramConnect key={familyId} familyId={familyId} />
        <ReceiptCapture familyId={familyId} />
        <h2 className="text-xl font-semibold">Review your drafts</h2>
        {drafts.isLoading ? (
          <p>Loading drafts...</p>
        ) : drafts.isError ? (
          <p role="alert">{drafts.error.message}</p>
        ) : drafts.data?.drafts.length === 0 ? (
          <p>No pending drafts. Nothing is saved automatically.</p>
        ) : (
          drafts.data?.drafts.map((draft) => (
            <DraftCard key={draft.id} familyId={familyId} draft={draft} />
          ))
        )}
      </div>
    </AppShell>
  );
}

function DraftCard({ familyId, draft }: { familyId: string; draft: FinanceDraftResponse }) {
  const { accessToken } = useAuth();
  const client = useQueryClient();
  const [payload, setPayload] = useState(draft.payload);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const accounts = useQuery({
    queryKey: ['finance-accounts', familyId, accessToken, draft.scope],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceAccounts(accessToken!, familyId, draft.scope),
  });
  const categories = useQuery({
    queryKey: ['finance-categories', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceCategories(accessToken!, familyId),
  });
  const dirty = JSON.stringify(payload) !== JSON.stringify(draft.payload);
  const expired = new Date(draft.expiresAt) <= new Date();
  async function act(action: 'confirm' | 'cancel' | 'correct') {
    if (!accessToken) return;
    if (
      action === 'confirm' &&
      !window.confirm(
        `Confirm ${draft.scope.toLowerCase()} ${draft.payload.type.toLowerCase()} of ${formatIdr(draft.payload.amountMinor)}?`,
      )
    )
      return;
    setPending(true);
    setError('');
    try {
      if (action === 'confirm') await confirmFinanceDraft(accessToken, familyId, draft.id);
      if (action === 'cancel') await cancelFinanceDraft(accessToken, familyId, draft.id);
      if (action === 'correct') {
        const amount = parseIdrInput(payload.amountMinor);
        if (!amount || amount === '0') {
          setError('Enter a positive rupiah amount.');
          return;
        }
        await replaceFinanceDraft(accessToken, familyId, draft.id, {
          ...payload,
          amountMinor: amount,
        });
      }
      await client.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith('finance-'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update draft');
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <h3 className="text-lg font-semibold">
        {draft.scope} · {draft.payload.type} · {draft.source}
      </h3>
      <p className="text-sm">
        Expires: {new Date(draft.expiresAt).toLocaleString()}.{' '}
        {expired
          ? 'Correct this draft to renew confirmation.'
          : 'Review every field before confirming.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`amount-${draft.id}`}>Amount</Label>
          <Input
            id={`amount-${draft.id}`}
            value={payload.amountMinor}
            onChange={(e) => setPayload({ ...payload, amountMinor: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`date-${draft.id}`}>Date</Label>
          <Input
            id={`date-${draft.id}`}
            type="date"
            value={payload.transactionDate}
            onChange={(e) => setPayload({ ...payload, transactionDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`account-${draft.id}`}>Account</Label>
          <Select
            id={`account-${draft.id}`}
            value={payload.accountId}
            onChange={(e) => setPayload({ ...payload, accountId: e.target.value })}
          >
            {accounts.data?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`category-${draft.id}`}>Category</Label>
          <Select
            id={`category-${draft.id}`}
            value={payload.categoryId ?? ''}
            onChange={(e) => setPayload({ ...payload, categoryId: e.target.value || null })}
          >
            <option value="">None</option>
            {categories.data?.categories
              .filter(
                (c) =>
                  c.isActive &&
                  (c.kind === payload.type ||
                    (c.kind === 'INVESTMENT' &&
                      ['DIVIDEND', 'INVESTMENT_BUY', 'INVESTMENT_SELL'].includes(payload.type))),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`description-${draft.id}`}>Description</Label>
          <Input
            id={`description-${draft.id}`}
            value={payload.description ?? ''}
            onChange={(e) => setPayload({ ...payload, description: e.target.value })}
          />
        </div>
        {payload.transferAccountId ? (
          <p>
            Destination:{' '}
            {accounts.data?.accounts.find((a) => a.id === payload.transferAccountId)?.name ??
              'Unavailable'}
          </p>
        ) : null}
      </div>
      {error || accounts.isError || categories.isError ? (
        <p role="alert">{error || 'Unable to load review options.'}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={pending || dirty || expired || !accounts.data || !categories.data}
          onClick={() => void act('confirm')}
        >
          Confirm and save
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => void act('correct')}>
          Save corrected draft
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => void act('cancel')}>
          Cancel draft
        </Button>
      </div>
    </Card>
  );
}
