'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Card, CardDescription, CardTitle, Input, Label, RumaBrand } from '@ruma/ui';
import { useAuth } from '@/lib/auth-context';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetNotice = searchParams.get('reset') === '1';
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
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
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Continue into your household workspace.</CardDescription>
        {resetNotice ? (
          <p className="mt-4 mb-0 text-sm text-[var(--ruma-color-ink-muted)]">
            Password updated. You can sign in with your new password.
          </p>
        ) : null}
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
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                className="text-xs text-[var(--ruma-color-ink-muted)] underline"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 mb-0 text-sm text-[var(--ruma-color-ink-muted)]">
          New here?{' '}
          <Link className="text-[var(--ruma-color-ink)] underline" href="/sign-up">
            Create an account
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
