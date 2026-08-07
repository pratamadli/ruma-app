'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import { useAuth } from '@/lib/auth-context';
import { ApiError, acceptInvitation, previewInvitation } from '@/lib/api';
import { useDispatch } from 'react-redux';
import { setActiveFamilyId } from '@/lib/store';

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, accessToken, loading, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const previewQuery = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => previewInvitation(token),
    retry: false,
  });

  async function acceptAsCurrentUser() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      const family = await acceptInvitation(accessToken, token);
      dispatch(setActiveFamilyId(family.id));
      router.push(`/app/f/${family.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invitation');
    } finally {
      setPending(false);
    }
  }

  async function onAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!previewQuery.data) return;
    setPending(true);
    setError(null);
    try {
      if (mode === 'sign-up') {
        await signUpWithPassword(previewQuery.data.email, password, name || undefined);
      } else {
        await signInWithPassword(previewQuery.data.email, password);
      }
      // accessToken updates asynchronously; accept using refreshed session via next tick API call after auth context updates.
      // Call accept with a short delay by reading from refresh is complex; instead accept in auth handlers below after sign-in returns.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setPending(false);
      return;
    }

    try {
      // Re-fetch token from refresh cookie path by calling accept after auth methods set state.
      // We need the new access token; signIn/signUp in context set it, but local accessToken may be stale.
      // Workaround: call acceptInvitation after getting token from a direct sign-in response is cleaner.
      // For simplicity, use window location reload after auth then auto-accept — but better:
      const { refreshSession } = await import('@/lib/api');
      const session = await refreshSession();
      const family = await acceptInvitation(session.accessToken, token);
      dispatch(setActiveFamilyId(family.id));
      router.push(`/app/f/${family.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invitation');
    } finally {
      setPending(false);
    }
  }

  if (previewQuery.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="text-[var(--ruma-color-ink-muted)]">Checking invitation…</p>
      </main>
    );
  }

  if (previewQuery.isError) {
    const message =
      previewQuery.error instanceof ApiError
        ? previewQuery.error.message
        : 'This invitation is invalid or no longer available.';
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-md">
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
          <div className="mt-4">
            <Link href="/">
              <Button variant="secondary">Go home</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const preview = previewQuery.data!;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardTitle>Join {preview.familyName}</CardTitle>
        <CardDescription>
          {preview.inviterName ?? 'Someone'} invited {preview.email} as {preview.role}.
          {preview.householdName ? ` Household: ${preview.householdName}.` : ''}
        </CardDescription>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">Checking your session…</p>
        ) : user ? (
          <div className="mt-6 grid gap-3">
            <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
              Signed in as <strong>{user.email}</strong>
            </p>
            {user.email.toLowerCase() !== preview.email.toLowerCase() ? (
              <p className="m-0 text-sm text-[var(--ruma-color-danger)]">
                This invitation was sent to {preview.email}. Sign in with that email to accept.
              </p>
            ) : (
              <Button onClick={() => void acceptAsCurrentUser()} disabled={pending}>
                {pending ? 'Joining…' : 'Accept invitation'}
              </Button>
            )}
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
          </div>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={onAuthSubmit}>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'sign-up' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setMode('sign-up')}
              >
                Create account
              </Button>
              <Button
                type="button"
                variant={mode === 'sign-in' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setMode('sign-in')}
              >
                Sign in
              </Button>
            </div>
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" value={preview.email} disabled />
            </div>
            {mode === 'sign-up' ? (
              <div>
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            ) : null}
            <div>
              <Label htmlFor="invite-password">Password</Label>
              <Input
                id="invite-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Working…'
                : mode === 'sign-up'
                  ? 'Create account & join'
                  : 'Sign in & join'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
