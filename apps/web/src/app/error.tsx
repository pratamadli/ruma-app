'use client';

import { Button } from '@ruma/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="grid max-w-md gap-4 text-center">
        <h1 className="m-0 text-2xl font-semibold">Something went wrong</h1>
        <p className="m-0 text-[var(--ruma-color-ink-muted)]">{error.message}</p>
        <div>
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </main>
  );
}
