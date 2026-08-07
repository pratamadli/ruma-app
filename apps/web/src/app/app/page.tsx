'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { createFamily, listFamilies } from '@/lib/api';
import { setActiveFamilyId, type RootState } from '@/lib/store';

export default function AppHomePage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const activeFamilyId = useSelector((state: RootState) => state.shell.activeFamilyId);
  const [name, setName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const familiesQuery = useQuery({
    queryKey: ['families', accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFamilies(accessToken!),
  });

  useEffect(() => {
    if (!familiesQuery.data) return;
    if (familiesQuery.data.families.length === 0) return;
    const preferred =
      familiesQuery.data.families.find((family) => family.id === activeFamilyId)?.id ??
      familiesQuery.data.families[0]?.id;
    if (preferred) {
      dispatch(setActiveFamilyId(preferred));
      router.replace(`/app/f/${preferred}`);
    }
  }, [familiesQuery.data, activeFamilyId, dispatch, router]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      const family = await createFamily(accessToken, {
        name,
        householdName: householdName || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      dispatch(setActiveFamilyId(family.id));
      await queryClient.invalidateQueries({ queryKey: ['families'] });
      router.push(`/app/f/${family.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create family');
    } finally {
      setPending(false);
    }
  }

  if (familiesQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-[var(--ruma-color-ink-muted)]">Loading families…</p>
      </AppShell>
    );
  }

  if ((familiesQuery.data?.families.length ?? 0) > 0) {
    return (
      <AppShell>
        <p className="text-[var(--ruma-color-ink-muted)]">Opening your family workspace…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto grid max-w-lg gap-6">
        <div>
          <h1 className="m-0 text-3xl font-semibold tracking-tight">
            Create your family workspace
          </h1>
          <p className="mt-2 text-[var(--ruma-color-ink-muted)]">
            RUMA starts with a shared household space. Invite your partner after this.
          </p>
        </div>
        <Card>
          <CardTitle>New family</CardTitle>
          <CardDescription>Keep it simple — you can refine settings later.</CardDescription>
          <form className="mt-4 grid gap-4" onSubmit={onCreate}>
            <div>
              <Label htmlFor="name">Family name</Label>
              <Input
                id="name"
                placeholder="Pratama Household"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="householdName">Household nickname (optional)</Label>
              <Input
                id="householdName"
                placeholder="Home"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </div>
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create family'}
            </Button>
          </form>
        </Card>
      </section>
    </AppShell>
  );
}
