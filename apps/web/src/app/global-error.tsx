'use client';

import * as Sentry from '@sentry/react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. You can try again.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
