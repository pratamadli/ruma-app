'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import type { TaskRecurrence } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { formatRecurrenceLabel, RecurrenceFields } from '@/components/recurrence-fields';
import { useAuth } from '@/lib/auth-context';
import { createEvent, deleteEvent, listEvents } from '@/lib/api';

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function CalendarPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('NONE');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventsQuery = useQuery({
    queryKey: ['events', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listEvents(accessToken!, familyId),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof eventsQuery.data>['events']>();
    for (const event of eventsQuery.data?.events ?? []) {
      const key = dayKey(event.startAt);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [eventsQuery.data]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !title.trim() || !startLocal) return;
    if (recurrence === 'CUSTOM_WEEKDAYS' && weekdays.length === 0) {
      setError('Pick at least one weekday for custom repeat.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const startAt = new Date(startLocal).toISOString();
      await createEvent(accessToken, familyId, {
        title: title.trim(),
        startAt,
        allDay,
        recurrence,
        recurrenceWeekdays: weekdays,
      });
      setTitle('');
      setStartLocal('');
      setRecurrence('NONE');
      setWeekdays([]);
      await queryClient.invalidateQueries({ queryKey: ['events', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['activity', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create event');
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-2">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="m-0 text-[var(--ruma-color-ink-muted)]">
            What&apos;s happening in our household?
          </p>
        </header>

        <Card>
          <CardTitle>Add event</CardTitle>
          <form className="mt-4 grid gap-3" onSubmit={onCreate}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Family dinner"
              required
            />
            <div>
              <Label htmlFor="start">Starts</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              All day
            </label>
            <RecurrenceFields
              idPrefix="event"
              recurrence={recurrence}
              weekdays={weekdays}
              onRecurrenceChange={setRecurrence}
              onWeekdaysChange={setWeekdays}
            />
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add event'}
            </Button>
          </form>
        </Card>

        {eventsQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading schedule…</p>
        ) : grouped.length === 0 ? (
          <Card>
            <CardTitle>No upcoming events</CardTitle>
            <CardDescription>Add doctor visits, dinners, or family plans.</CardDescription>
          </Card>
        ) : (
          <div className="grid gap-6">
            {grouped.map(([day, events]) => (
              <section key={day} className="grid gap-3">
                <h2 className="m-0 text-lg font-semibold">{day}</h2>
                <ul className="grid gap-2 p-0">
                  {events.map((item) => {
                    const repeat = formatRecurrenceLabel(item.recurrence, item.recurrenceWeekdays);
                    return (
                      <li
                        key={item.id}
                        className="flex list-none items-start justify-between gap-3 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-3"
                      >
                        <div>
                          <div className="text-sm text-[var(--ruma-color-ink-muted)]">
                            {item.allDay
                              ? 'All day'
                              : new Date(item.startAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                            {repeat ? ` · ${repeat}` : ''}
                          </div>
                          <div className="font-medium">{item.title}</div>
                          {item.location ? (
                            <div className="text-sm text-[var(--ruma-color-ink-muted)]">
                              {item.location}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!accessToken) return;
                            await deleteEvent(accessToken, familyId, item.id);
                            await queryClient.invalidateQueries({ queryKey: ['events', familyId] });
                            await queryClient.invalidateQueries({
                              queryKey: ['dashboard', familyId],
                            });
                            await queryClient.invalidateQueries({
                              queryKey: ['activity', familyId],
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
