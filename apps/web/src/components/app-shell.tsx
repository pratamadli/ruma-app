'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, RumaBrand, Select } from '@ruma/ui';
import { useAuth } from '@/lib/auth-context';
import { hydrateActiveFamilyId, setActiveFamilyId, type RootState } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { listFamilies } from '@/lib/api';
import { NotificationsMenu } from '@/components/notifications-menu';
import { APP_VERSION } from '@/lib/version';

function shellLinkClass(active: boolean) {
  return [
    'shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium no-underline transition-colors',
    active
      ? 'bg-[var(--ruma-color-ink)] text-[var(--ruma-color-surface)]'
      : 'bg-black/[0.04] text-[var(--ruma-color-ink-muted)] hover:bg-black/[0.07] hover:text-[var(--ruma-color-ink)]',
  ].join(' ');
}

export function AppShell({ children, familyId }: { children: React.ReactNode; familyId?: string }) {
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const activeFamilyId = useSelector((state: RootState) => state.shell.activeFamilyId);

  useEffect(() => {
    dispatch(hydrateActiveFamilyId());
  }, [dispatch]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sign-in');
    }
  }, [loading, user, router]);

  const familiesQuery = useQuery({
    queryKey: ['families', accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFamilies(accessToken!),
  });

  useEffect(() => {
    if (familyId) {
      dispatch(setActiveFamilyId(familyId));
    }
  }, [familyId, dispatch]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="text-[var(--ruma-color-ink-muted)]">Loading workspace…</p>
      </main>
    );
  }

  const currentFamilyId = familyId ?? activeFamilyId;
  const base = currentFamilyId ? `/app/f/${currentFamilyId}` : '/app';
  const families = familiesQuery.data?.families ?? [];

  const navItems = currentFamilyId
    ? [
        { href: base, label: 'Home', active: pathname === base },
        {
          href: `${base}/tasks`,
          label: 'Tasks',
          active: Boolean(pathname?.includes('/tasks')),
        },
        {
          href: `${base}/grocery`,
          label: 'Grocery',
          active: Boolean(pathname?.includes('/grocery')),
        },
        {
          href: `${base}/calendar`,
          label: 'Calendar',
          active: Boolean(pathname?.includes('/calendar')),
        },
        {
          href: `${base}/finance`,
          label: 'Finance',
          active: Boolean(pathname?.includes('/finance')),
        },
        {
          href: `${base}/members`,
          label: 'Family',
          active: Boolean(pathname?.includes('/members')),
        },
        {
          href: `${base}/settings`,
          label: 'Settings',
          active: Boolean(pathname?.includes('/settings')),
        },
      ]
    : [];

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 border-b border-[var(--ruma-color-border)] pb-4 sm:mb-6">
        {/* Top row: brand + actions — never compete with nav links */}
        <div className="flex items-center gap-2">
          <Link href="/app" className="min-w-0 no-underline" aria-label="RUMA home">
            <RumaBrand className="gap-2" markClassName="h-7 w-7 sm:h-8 sm:w-8" />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationsMenu />
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 whitespace-nowrap px-2.5 sm:px-3"
              onClick={async () => {
                await logout();
                router.push('/');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Family switcher on its own row so it doesn't crush the header */}
        {families.length > 0 ? (
          <div className="mt-3 sm:mt-3.5 sm:max-w-xs">
            <Select
              id="family-switcher"
              aria-label="Switch family"
              value={currentFamilyId ?? ''}
              onChange={(event) => {
                const next = event.target.value;
                dispatch(setActiveFamilyId(next));
                router.push(`/app/f/${next}`);
              }}
            >
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {/* Horizontal scroll nav on mobile; wraps cleanly on larger screens */}
        {navItems.length > 0 ? (
          <nav
            aria-label="Household"
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={shellLinkClass(item.active)}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="min-w-0">{children}</div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ruma-color-ink-muted)]">
        <p className="m-0 min-w-0 truncate">
          <Link href="/">RUMA</Link>
          <span className="hidden sm:inline"> · signed in as {user.email}</span>
        </p>
        <p className="m-0 tracking-[0.12em] text-[var(--ruma-color-ink-muted)]/55">
          v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
}
