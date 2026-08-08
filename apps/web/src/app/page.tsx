import Link from 'next/link';
import { Button, RumaLockup } from '@ruma/ui';
import { APP_VERSION } from '@/lib/version';

export default function HomePage() {
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--ruma-color-accent-soft)_85%,transparent),transparent_55%),linear-gradient(180deg,var(--ruma-color-surface),color-mix(in_srgb,var(--ruma-color-accent-soft)_35%,var(--ruma-color-surface)))]"
      />
      <section className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 py-8">
        <RumaLockup withTagline />
        <p className="m-0 max-w-md text-lg leading-relaxed text-[var(--ruma-color-ink-muted)]">
          Your household workspace — tasks, groceries, calendar, and family life in one calm place.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-in">
            <Button>Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="secondary">Create account</Button>
          </Link>
        </div>
      </section>
      <footer className="relative z-10 flex shrink-0 justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Quiet entry to the design system — not advertised in the main CTA row */}
        <Link
          href="/design-system"
          className="text-[0.7rem] tracking-[0.14em] text-[var(--ruma-color-ink-muted)]/45 no-underline transition-colors hover:text-[var(--ruma-color-ink-muted)]"
          aria-label={`RUMA version ${APP_VERSION}. Open design system.`}
        >
          v{APP_VERSION}
        </Link>
      </footer>
    </main>
  );
}
