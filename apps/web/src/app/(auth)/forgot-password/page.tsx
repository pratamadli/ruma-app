'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, CardDescription, CardTitle, Input, Label, RumaBrand } from '@ruma/ui';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email');
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
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>
          Enter your email and we’ll send a reset link if an account exists.
        </CardDescription>
        {sent ? (
          <p className="mt-6 mb-0 text-sm text-[var(--ruma-color-ink-muted)]">
            If an account exists for that email, a reset link is on its way. Check your inbox, then
            return to{' '}
            <Link className="text-[var(--ruma-color-ink)] underline" href="/sign-in">
              sign in
            </Link>
            .
          </p>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <p className="mt-4 mb-0 text-sm text-[var(--ruma-color-ink-muted)]">
          <Link className="text-[var(--ruma-color-ink)] underline" href="/sign-in">
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
