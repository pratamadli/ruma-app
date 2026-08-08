'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, CardDescription, CardTitle, Input, Label, RumaBrand } from '@ruma/ui';
import { resetPassword } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await resetPassword({ token, password });
      router.push('/sign-in?reset=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <Card className="w-full max-w-md">
        <Link href="/" className="mb-6 inline-flex no-underline" aria-label="RUMA home">
          <RumaBrand />
        </Link>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a strong password for your RUMA account.</CardDescription>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
          <Button type="submit" disabled={pending || !token}>
            {pending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
