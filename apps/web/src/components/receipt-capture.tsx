'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import type { FinanceReceiptResponse } from '@ruma/types';
import { useAuth } from '@/lib/auth-context';
import {
  createReceiptDraft,
  downloadFinanceReceipt,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceReceipts,
  uploadFinanceReceipt,
} from '@/lib/api';
import { parseIdrInput, todayDateOnly } from '@/lib/money';
import { FinanceScopePicker, useFinanceScope } from './finance-scope';

export function ReceiptCapture({ familyId }: { familyId: string }) {
  const { accessToken } = useAuth(),
    { scope } = useFinanceScope();
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ['finance-receipts', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceReceipts(accessToken!, familyId),
  });
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Choose a PNG/JPEG up to 5 MB.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await uploadFinanceReceipt(accessToken, familyId, scope, file);
      await client.invalidateQueries({ queryKey: ['finance-receipts', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload receipt');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-semibold">Receipts</h2>
      <FinanceScopePicker />
      <Card>
        <form onSubmit={upload} className="grid gap-3">
          <Label htmlFor="receipt-image">PNG/JPEG image, maximum 5 MB</Label>
          <Input
            id="receipt-image"
            type="file"
            accept="image/png,image/jpeg"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button disabled={pending}>{pending ? 'Extracting...' : 'Upload for review'}</Button>
        </form>
        <p className="text-sm">
          Extraction never saves a financial transaction. Review and correct the draft first.
        </p>
      </Card>
      {error || query.isError ? <p role="alert">{error || query.error?.message}</p> : null}
      {query.isLoading ? (
        <p>Loading receipts...</p>
      ) : (
        query.data?.receipts
          .filter((receipt) => receipt.scope === scope)
          .map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} familyId={familyId} />)
      )}
    </section>
  );
}

function ReceiptRow({ receipt, familyId }: { receipt: FinanceReceiptResponse; familyId: string }) {
  const { accessToken } = useAuth();
  const client = useQueryClient();
  const [amount, setAmount] = useState(receipt.extraction.totalMinor ?? '');
  const [date, setDate] = useState(receipt.extraction.date ?? todayDateOnly());
  const [description, setDescription] = useState(receipt.extraction.merchant ?? '');
  const [accountId, setAccountId] = useState(''),
    [categoryId, setCategoryId] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const accounts = useQuery({
    queryKey: ['finance-accounts', familyId, accessToken, receipt.scope],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceAccounts(accessToken!, familyId, receipt.scope),
  });
  const categories = useQuery({
    queryKey: ['finance-categories', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceCategories(accessToken!, familyId),
  });
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const amountMinor = parseIdrInput(amount);
    if (!amountMinor || amountMinor === '0') {
      setError('Enter a positive amount.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await createReceiptDraft(accessToken, familyId, receipt.id, {
        type: 'EXPENSE',
        scope: receipt.scope,
        amountMinor,
        accountId,
        categoryId: categoryId || null,
        transactionDate: date,
        description,
      });
      if (result.possibleDuplicateTransactionId)
        setError(
          'Possible duplicate transaction detected. Check history before confirming the draft.',
        );
      await client.invalidateQueries({ queryKey: ['finance-drafts', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare receipt draft');
    } finally {
      setPending(false);
    }
  }
  async function download() {
    if (!accessToken) return;
    try {
      await downloadFinanceReceipt(accessToken, familyId, receipt.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download receipt');
    }
  }
  return (
    <Card>
      <p>
        {receipt.status} · Confidence {Math.round((receipt.extraction.confidence ?? 0) * 100)}%
      </p>
      {receipt.errorCode ? (
        <p role="status">Extraction unavailable ({receipt.errorCode}). Enter details manually.</p>
      ) : null}
      <Button variant="ghost" onClick={() => void download()}>
        Download image
      </Button>
      {receipt.transactionId ? (
        <p>Attached to a confirmed transaction.</p>
      ) : (
        <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`receipt-amount-${receipt.id}`}>Total</Label>
            <Input
              id={`receipt-amount-${receipt.id}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`receipt-date-${receipt.id}`}>Date</Label>
            <Input
              id={`receipt-date-${receipt.id}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`receipt-account-${receipt.id}`}>Account</Label>
            <Select
              id={`receipt-account-${receipt.id}`}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Choose account</option>
              {accounts.data?.accounts
                .filter((a) => a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`receipt-category-${receipt.id}`}>Category</Label>
            <Select
              id={`receipt-category-${receipt.id}`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">None</option>
              {categories.data?.categories
                .filter((c) => c.isActive && c.kind === 'EXPENSE')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`receipt-description-${receipt.id}`}>Merchant / description</Label>
            <Input
              id={`receipt-description-${receipt.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button disabled={pending || accounts.isError || categories.isError}>
            {pending ? 'Preparing...' : 'Create pending draft'}
          </Button>
        </form>
      )}
      {receipt.extraction.lineItems?.length ? (
        <details>
          <summary>Extracted line items</summary>
          <ul>
            {receipt.extraction.lineItems.map((item, index) => (
              <li key={index}>
                {item.description}: {item.amountMinor} IDR
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {error || accounts.isError || categories.isError ? (
        <p role="alert">{error || 'Unable to load form options.'}</p>
      ) : null}
    </Card>
  );
}
