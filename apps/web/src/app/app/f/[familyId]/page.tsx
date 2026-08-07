'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { getFamily, listActivity, listMembers } from '@/lib/api';
import { formatActivity } from '@/lib/activity-copy';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function FamilyDashboardPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { user, accessToken } = useAuth();

  const familyQuery = useQuery({
    queryKey: ['family', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getFamily(accessToken!, familyId),
  });

  const membersQuery = useQuery({
    queryKey: ['members', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listMembers(accessToken!, familyId),
  });

  const activityQuery = useQuery({
    queryKey: ['activity', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listActivity(accessToken!, familyId),
  });

  const family = familyQuery.data;
  const displayName = user?.name ?? user?.email ?? 'there';

  return (
    <AppShell familyId={familyId}>
      {familyQuery.isLoading ? (
        <p className="text-[var(--ruma-color-ink-muted)]">Loading family…</p>
      ) : familyQuery.isError ? (
        <Card>
          <CardTitle>Unable to open this family</CardTitle>
          <CardDescription>
            {familyQuery.error instanceof Error
              ? familyQuery.error.message
              : 'You may not have access.'}
          </CardDescription>
          <div className="mt-4">
            <Link href="/app">
              <Button variant="secondary">Back to families</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          <header className="grid gap-2">
            <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">{greeting()}</p>
            <h1 className="m-0 text-3xl font-semibold tracking-tight sm:text-4xl">{displayName}</h1>
            <p className="m-0 text-lg text-[var(--ruma-color-ink-muted)]">
              {family?.householdName ? `${family.householdName} · ` : ''}
              {family?.name}
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardTitle>Family members</CardTitle>
              <CardDescription>
                {membersQuery.data?.members.length ?? 0} people in this workspace
              </CardDescription>
              <ul className="mt-4 grid gap-2 p-0">
                {(membersQuery.data?.members ?? []).map((member) => (
                  <li
                    key={member.membershipId}
                    className="flex list-none items-center justify-between rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-4 py-3"
                  >
                    <div>
                      <strong>{member.name ?? member.email}</strong>
                      {member.userId === user?.id ? (
                        <span className="ml-2 text-sm text-[var(--ruma-color-ink-muted)]">You</span>
                      ) : null}
                      <div className="text-sm text-[var(--ruma-color-ink-muted)]">
                        {member.email}
                      </div>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ruma-color-accent)]">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
              {membersQuery.isLoading ? (
                <p className="mt-3 text-sm text-[var(--ruma-color-ink-muted)]">Loading members…</p>
              ) : null}
            </Card>

            <Card>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Keep the household connected.</CardDescription>
              <div className="mt-4 grid gap-2">
                <Link href={`/app/f/${familyId}/members`}>
                  <Button className="w-full" variant="secondary">
                    Invite member
                  </Button>
                </Link>
                <Link href={`/app/f/${familyId}/members`}>
                  <Button className="w-full" variant="ghost">
                    View members
                  </Button>
                </Link>
                <Link href={`/app/f/${familyId}/settings`}>
                  <Button className="w-full" variant="ghost">
                    Family settings
                  </Button>
                </Link>
              </div>
            </Card>
          </section>

          <Card>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent family events</CardDescription>
            {activityQuery.isLoading ? (
              <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">Loading activity…</p>
            ) : (activityQuery.data?.activities.length ?? 0) === 0 ? (
              <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">No activity yet.</p>
            ) : (
              <ul className="mt-4 grid gap-3 p-0">
                {activityQuery.data?.activities.map((item) => (
                  <li
                    key={item.id}
                    className="list-none border-b border-[var(--ruma-color-border)] pb-3 last:border-none"
                  >
                    <div className="font-medium">{formatActivity(item)}</div>
                    <div className="text-xs text-[var(--ruma-color-ink-muted)]">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
