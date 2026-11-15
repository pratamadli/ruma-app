'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import type { TelegramLinkCodeResponse } from '@ruma/types';
import { useAuth } from '@/lib/auth-context';
import { createTelegramLink, getTelegramLink, unlinkTelegram } from '@/lib/api';

export function TelegramConnect({ familyId }: { familyId: string }) {
  const { accessToken } = useAuth();
  const client = useQueryClient();
  const [code, setCode] = useState<TelegramLinkCodeResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const status = useQuery({
    queryKey: ['telegram-link', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => getTelegramLink(accessToken!, familyId),
    refetchInterval: (query) =>
      code && new Date(code.expiresAt) > new Date() && !query.state.data?.linked ? 3000 : false,
  });
  const command = code ? `/ruma connect ${code.email} ${code.code}` : '';

  async function connect() {
    if (!accessToken) return;
    setPending(true);
    setError('');
    setCopied(false);
    try {
      setCode(await createTelegramLink(accessToken, familyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create a connection code.');
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    if (!accessToken || !window.confirm('Disconnect your Telegram account from this household?'))
      return;
    setPending(true);
    setError('');
    try {
      await unlinkTelegram(accessToken, familyId);
      setCode(null);
      await client.invalidateQueries({ queryKey: ['telegram-link'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect Telegram.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setError('Unable to copy automatically. Select and copy the command below.');
    }
  }

  return (
    <Card>
      <CardTitle>RUMA Assistant on Telegram</CardTitle>
      <CardDescription>
        One bot, your selected household. Connect your own account in a private chat.
      </CardDescription>
      {status.isLoading ? <p role="status">Checking Telegram connection...</p> : null}
      {status.data?.linked ? (
        <p role="status">Your Telegram account is connected to this household.</p>
      ) : null}
      {status.data?.connectedElsewhere ? (
        <p>
          Your Telegram account is connected to another household. Verifying a new code will switch
          its active household.
        </p>
      ) : null}
      {status.data?.requiresReconnect ? (
        <p>
          Your previous Telegram connection no longer has an authorized household. Reconnect here or
          disconnect the old account.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {status.data?.linked ? (
          <Button variant="secondary" disabled={pending} onClick={() => void disconnect()}>
            Disconnect Telegram
          </Button>
        ) : (
          <Button
            disabled={pending || status.isLoading || status.isError}
            onClick={() => void connect()}
          >
            {pending ? 'Creating code...' : code ? 'Generate new code' : 'Connect to Telegram'}
          </Button>
        )}
        {status.data?.requiresReconnect ? (
          <Button variant="secondary" disabled={pending} onClick={() => void disconnect()}>
            Disconnect old Telegram account
          </Button>
        ) : null}
        {status.isError ? (
          <Button variant="secondary" onClick={() => void status.refetch()}>
            Retry
          </Button>
        ) : null}
      </div>
      {code && !status.data?.linked ? (
        <div className="mt-4 grid gap-3">
          <p>
            Connect to <strong>{code.household.name}</strong> using your RUMA email:{' '}
            <strong className="break-all">{code.email}</strong>.
          </p>
          <div className="grid gap-1">
            <Label htmlFor={`telegram-code-${familyId}`}>Your one-time connection code</Label>
            <Input id={`telegram-code-${familyId}`} value={code.code} readOnly />
          </div>
          <p className="text-sm">
            Expires at {new Date(code.expiresAt).toLocaleTimeString()}. A new code invalidates your
            previous code. Do not share it; other members must generate their own.
          </p>
          <Label htmlFor={`telegram-command-${familyId}`}>
            Send this command in a private chat with the configured RUMA Assistant bot
          </Label>
          <textarea
            id={`telegram-command-${familyId}`}
            className="w-full rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] bg-transparent p-3 text-sm"
            value={command}
            readOnly
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy connection command'}
            </Button>
            {code.botUrl ? (
              <a
                href={code.botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm"
              >
                Open Telegram bot
              </a>
            ) : null}
          </div>
          <p className="text-sm">
            The bot verifies your email, code and active household membership. Financial writes
            still require confirmation.
          </p>
        </div>
      ) : null}
      {error || status.isError ? <p role="alert">{error || status.error?.message}</p> : null}
    </Card>
  );
}
