'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardDescription, CardTitle } from '@ruma/ui';
import { useAuth } from '@/lib/auth-context';
import { completeGmailOAuth } from '@/lib/api';
import { GMAIL_OAUTH_FAMILY_KEY, GMAIL_OAUTH_STATE_KEY } from '@/lib/gmail-oauth';

export default function GmailCallbackPage() {
  return (
    <Suspense fallback={<Shell message="Finishing Gmail connection…" />}>
      <GmailCallbackInner />
    </Suspense>
  );
}

function GmailCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [familyHint, setFamilyHint] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(
        oauthError === 'access_denied'
          ? 'Gmail connection was cancelled.'
          : 'Google could not authorize RUMA. Please try again.',
      );
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const familyId = sessionStorage.getItem(GMAIL_OAUTH_FAMILY_KEY);
    const expectedState = sessionStorage.getItem(GMAIL_OAUTH_STATE_KEY);
    setFamilyHint(familyId);

    if (!code || !state || !familyId) {
      setError('Missing authorization details. Start again from Finance → Imports.');
      return;
    }
    if (expectedState && expectedState !== state) {
      setError('Authorization state did not match. Please try connecting again.');
      return;
    }
    if (!accessToken) {
      setError('Sign in to finish connecting Gmail.');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await completeGmailOAuth(accessToken, familyId, { code, state });
        sessionStorage.removeItem(GMAIL_OAUTH_FAMILY_KEY);
        sessionStorage.removeItem(GMAIL_OAUTH_STATE_KEY);
        if (!cancelled) {
          router.replace(`/app/f/${familyId}/finance/imports?gmail=connected`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not finish Gmail connection.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, router, searchParams]);

  if (error) {
    return (
      <Shell message={error}>
        <Link
          href={familyHint ? `/app/f/${familyHint}/finance/imports` : '/app'}
          className="no-underline"
        >
          <Button type="button">Back to RUMA</Button>
        </Link>
      </Shell>
    );
  }

  return <Shell message="Finishing Gmail connection…" />;
}

function Shell({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--ruma-color-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardTitle>Gmail</CardTitle>
        <CardDescription>{message}</CardDescription>
        {children ? <div className="mt-4">{children}</div> : null}
      </Card>
    </main>
  );
}
