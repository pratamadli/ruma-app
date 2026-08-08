'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { getFamily, getHouseholdDashboard, listActivity } from '@/lib/api';
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

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getHouseholdDashboard(accessToken!, familyId),
  });

  const activityQuery = useQuery({
    queryKey: ['activity', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listActivity(accessToken!, familyId),
  });

  const family = familyQuery.data;
  const dash = dashboardQuery.data;
  const displayName = user?.name ?? user?.email ?? 'there';

  return (
    <AppShell familyId={familyId}>
      {familyQuery.isLoading ? (
        <p className="text-[var(--ruma-color-ink-muted)]">Loading household…</p>
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

          <section className="grid gap-3 sm:grid-cols-3">
            <Link href={`/app/f/${familyId}/tasks`} className="no-underline">
              <Card className="h-full transition-colors hover:bg-black/[0.02]">
                <CardTitle>Today&apos;s tasks</CardTitle>
                <p className="mt-3 mb-0 text-3xl font-semibold tracking-tight">
                  {dash?.todayTasksRemaining ?? '—'}
                </p>
                <CardDescription>remaining</CardDescription>
              </Card>
            </Link>
            <Link href={`/app/f/${familyId}/grocery`} className="no-underline">
              <Card className="h-full transition-colors hover:bg-black/[0.02]">
                <CardTitle>Grocery</CardTitle>
                <p className="mt-3 mb-0 text-3xl font-semibold tracking-tight">
                  {dash?.groceryOpenCount ?? '—'}
                </p>
                <CardDescription>open items</CardDescription>
              </Card>
            </Link>
            <Link href={`/app/f/${familyId}/calendar`} className="no-underline">
              <Card className="h-full transition-colors hover:bg-black/[0.02]">
                <CardTitle>Upcoming</CardTitle>
                <p className="mt-3 mb-0 text-3xl font-semibold tracking-tight">
                  {dash?.upcomingEventsCount ?? '—'}
                </p>
                <CardDescription>events</CardDescription>
              </Card>
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>Focus tasks</CardTitle>
              <CardDescription>What needs attention soon</CardDescription>
              {(dash?.todayTasks.length ?? 0) === 0 ? (
                <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">No open tasks.</p>
              ) : (
                <ul className="mt-4 grid gap-2 p-0">
                  {dash?.todayTasks.map((task) => (
                    <li
                      key={task.id}
                      className="list-none border-b border-[var(--ruma-color-border)] pb-2 last:border-none"
                    >
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-[var(--ruma-color-ink-muted)]">
                        {task.dueDate ? `Due ${task.dueDate}` : 'No due date'}
                        {task.assignedTo
                          ? ` · ${task.assignedTo.name ?? task.assignedTo.email}`
                          : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Coming up</CardTitle>
              <CardDescription>Family schedule</CardDescription>
              {(dash?.upcomingEvents.length ?? 0) === 0 ? (
                <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">
                  No upcoming events.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2 p-0">
                  {dash?.upcomingEvents.map((event) => (
                    <li
                      key={event.id}
                      className="list-none border-b border-[var(--ruma-color-border)] pb-2 last:border-none"
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs text-[var(--ruma-color-ink-muted)]">
                        {new Date(event.startAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <Card>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>What changed in the household</CardDescription>
            {activityQuery.isLoading ? (
              <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">Loading activity…</p>
            ) : (activityQuery.data?.activities.length ?? 0) === 0 ? (
              <p className="mt-4 text-sm text-[var(--ruma-color-ink-muted)]">No activity yet.</p>
            ) : (
              <ul className="mt-4 grid gap-3 p-0">
                {activityQuery.data?.activities.slice(0, 8).map((item) => (
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
