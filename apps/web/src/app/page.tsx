import Link from 'next/link';
import { Button } from '@ruma/ui';
import { ApiHealthBadge } from '@/components/api-health-badge';

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="grid w-full max-w-3xl gap-6">
        <p className="m-0 text-xs uppercase tracking-[0.18em] text-[var(--ruma-color-ink-muted)]">
          Household operating system
        </p>
        <h1 className="m-0 font-[family-name:var(--ruma-font-display)] text-[clamp(3rem,8vw,5rem)] font-bold leading-[0.95] tracking-[-0.04em]">
          RUMA
        </h1>
        <p className="m-0 max-w-xl text-lg text-[var(--ruma-color-ink-muted)]">
          Your family&apos;s second brain. Foundation phase — authentication, family tenancy, and
          design system are ready for MVP work.
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
