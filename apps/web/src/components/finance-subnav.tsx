'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { suffix: '', label: 'Overview' },
  { suffix: '/budgets', label: 'Budgets' },
  { suffix: '/transactions', label: 'Transactions' },
  { suffix: '/accounts', label: 'Accounts' },
  { suffix: '/categories', label: 'Categories' },
] as const;

export function FinanceSubnav({ familyId }: { familyId: string }) {
  const pathname = usePathname();
  const base = `/app/f/${familyId}/finance`;

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
      {links.map((link, index) => {
        const href = `${base}${link.suffix}`;
        const active =
          link.suffix === ''
            ? pathname === base
            : Boolean(pathname?.startsWith(`${base}${link.suffix}`));
        return (
          <span key={href} className="inline-flex items-center gap-2">
            {index > 0 ? <span className="text-[var(--ruma-color-ink-muted)]">·</span> : null}
            <Link
              href={href}
              className={
                active
                  ? 'font-medium text-[var(--ruma-color-ink)] no-underline'
                  : 'text-[var(--ruma-color-ink-muted)] no-underline hover:text-[var(--ruma-color-ink)]'
              }
            >
              {link.label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
