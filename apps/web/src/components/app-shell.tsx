'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Nav, NavBrand, NavLink } from '@ruma/ui';
import { useAuth } from '@/lib/auth-context';
import { hydrateActiveFamilyId, setActiveFamilyId, type RootState } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { listFamilies } from '@/lib/api';

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

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6">
      <Nav className="mb-6">
        <NavBrand href="/app">RUMA</NavBrand>
        {currentFamilyId ? (
          <>
            <NavLink
              href={base}
              className={pathname === base ? 'text-[var(--ruma-color-ink)] bg-black/5' : undefined}
            >
              Home
            </NavLink>
            <NavLink
              href={`${base}/members`}
              className={
                pathname?.includes('/members')
                  ? 'text-[var(--ruma-color-ink)] bg-black/5'
                  : undefined
              }
            >
              Family
            </NavLink>
            <NavLink
              href={`${base}/settings`}
              className={
                pathname?.includes('/settings')
                  ? 'text-[var(--ruma-color-ink)] bg-black/5'
                  : undefined
              }
            >
              Settings
            </NavLink>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {(familiesQuery.data?.families.length ?? 0) > 1 ? (
            <label className="sr-only" htmlFor="family-switcher">
              Switch family
            </label>
          ) : null}
          {(familiesQuery.data?.families.length ?? 0) > 0 ? (
            <select
              id="family-switcher"
              className="max-w-[10rem] rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] bg-white px-2 py-2 text-sm sm:max-w-xs"
              value={currentFamilyId ?? ''}
              onChange={(event) => {
                const next = event.target.value;
                dispatch(setActiveFamilyId(next));
                router.push(`/app/f/${next}`);
              }}
            >
              {familiesQuery.data?.families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              router.push('/');
            }}
          >
            Sign out
          </Button>
        </div>
      </Nav>
      {children}
      <p className="mt-10 text-xs text-[var(--ruma-color-ink-muted)]">
        <Link href="/">RUMA</Link> · signed in as {user.email}
      </p>
    </div>
  );
}
