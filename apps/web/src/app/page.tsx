import Link from 'next/link';
import { Button, RumaLockup } from '@ruma/ui';
import { ApiHealthBadge } from '@/components/api-health-badge';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--ruma-color-accent-soft)_85%,transparent),transparent_55%),linear-gradient(180deg,var(--ruma-color-surface),color-mix(in_srgb,var(--ruma-color-accent-soft)_35%,var(--ruma-color-surface)))]"
      />
      <section className="relative mx-auto grid min-h-[min(100vh,52rem)] w-full max-w-3xl place-content-center gap-8">
        <RumaLockup withTagline className="h-auto w-full max-w-md text-[var(--ruma-color-ink)]" />
        <p className="m-0 max-w-xl text-lg text-[var(--ruma-color-ink-muted)]">
          Foundation phase — authentication, family tenancy, and design system are ready for MVP
          work.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-in">
            <Button>Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="secondary">Create account</Button>
          </Link>
          <Link href="/design-system">
            <Button variant="ghost">Design system</Button>
          </Link>
        </div>
        <ApiHealthBadge />
      </section>
    </main>
  );
}
