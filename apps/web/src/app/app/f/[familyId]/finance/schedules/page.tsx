'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import type { FinanceScheduleResponse } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { FinanceScopePicker, useFinanceScope } from '@/components/finance-scope';
import { useAuth } from '@/lib/auth-context';
import {
  createFinanceSchedule,
  listFinanceSchedules,
  listMembers,
  updateFinanceSchedule,
} from '@/lib/api';

export default function SchedulesPage() {
  const { familyId } = useParams<{ familyId: string }>(),
    { accessToken } = useAuth(),
    { scope } = useFinanceScope();
  const client = useQueryClient();
  const [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [kind, setKind] = useState<'REMINDER' | 'MONTHLY_REPORT'>('REMINDER');
  const [due, setDue] = useState(''),
    [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [day, setDay] = useState('1'),
    [time, setTime] = useState('09:00'),
    [recipients, setRecipients] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ['finance-schedules', familyId, accessToken, scope],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceSchedules(accessToken!, familyId, scope),
  });
  const members = useQuery({
    queryKey: ['family-members', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listMembers(accessToken!, familyId),
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setPending(true);
    setError('');
    try {
      const [hour, minute] = time.split(':').map(Number);
      const input = {
        scope,
        kind,
        title,
        description,
        timezone,
        dueAt: kind === 'REMINDER' ? new Date(due).toISOString() : undefined,
        deliveryDay: Number(day),
        deliveryHour: hour,
        deliveryMinute: minute,
        recipientIds: scope === 'PERSONAL' ? [] : recipients,
      };
      if (editing) await updateFinanceSchedule(accessToken, familyId, editing, input);
      else await createFinanceSchedule(accessToken, familyId, input);
      setEditing(null);
      setTitle('');
      await client.invalidateQueries({ queryKey: ['finance-schedules', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save schedule');
    } finally {
      setPending(false);
    }
  }
  function edit(schedule: FinanceScheduleResponse) {
    setEditing(schedule.id);
    setTitle(schedule.title);
    setDescription(schedule.description ?? '');
    setKind(schedule.kind === 'MONTHLY_REPORT' ? 'MONTHLY_REPORT' : 'REMINDER');
    setTimezone(schedule.timezone);
    setDay(String(schedule.deliveryDay));
    setTime(
      `${String(schedule.deliveryHour).padStart(2, '0')}:${String(schedule.deliveryMinute).padStart(2, '0')}`,
    );
    setRecipients(schedule.recipientIds);
    if (schedule.dueAt) {
      const date = new Date(schedule.dueAt);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      setDue(date.toISOString().slice(0, 16));
    }
  }
  async function toggle(schedule: FinanceScheduleResponse) {
    if (!accessToken) return;
    try {
      await updateFinanceSchedule(accessToken, familyId, schedule.id, {
        enabled: !schedule.enabled,
      });
      await client.invalidateQueries({ queryKey: ['finance-schedules', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update schedule');
    }
  }
  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <h1 className="text-3xl font-semibold">Reminders & reports</h1>
          <FinanceSubnav familyId={familyId} />
          <FinanceScopePicker
            onChange={() => {
              setEditing(null);
              setRecipients([]);
            }}
          />
        </header>
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="schedule-title">Title</Label>
              <Input
                id="schedule-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="schedule-kind">Kind</Label>
              <Select
                id="schedule-kind"
                value={kind}
                disabled={Boolean(editing)}
                onChange={(e) =>
                  setKind(e.target.value === 'MONTHLY_REPORT' ? 'MONTHLY_REPORT' : 'REMINDER')
                }
              >
                <option value="REMINDER">One-time reminder</option>
                <option value="MONTHLY_REPORT">Monthly report</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="schedule-description">Description</Label>
              <Input
                id="schedule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {kind === 'REMINDER' ? (
              <div>
                <Label htmlFor="schedule-due">Due time (your device timezone)</Label>
                <Input
                  id="schedule-due"
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="schedule-timezone">Delivery timezone</Label>
                  <Input
                    id="schedule-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-day">Day of month (1-28)</Label>
                  <Input
                    id="schedule-day"
                    type="number"
                    min="1"
                    max="28"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-time">Delivery time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            {scope === 'HOUSEHOLD' ? (
              <fieldset className="grid gap-2">
                <legend>Recipients (none selected means all active members)</legend>
                {members.data?.members.map((member) => (
                  <label key={member.userId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recipients.includes(member.userId)}
                      onChange={(e) =>
                        setRecipients(
                          e.target.checked
                            ? [...recipients, member.userId]
                            : recipients.filter((id) => id !== member.userId),
                        )
                      }
                    />
                    {member.name ?? member.email}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p>Personal reminders and reports notify only you.</p>
            )}
            <Button disabled={pending}>{editing ? 'Update schedule' : 'Create schedule'}</Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel edit
              </Button>
            ) : null}
          </form>
          <p className="text-sm">
            Telegram linking and the server scheduler must be configured. Reports summarize the
            previous month. Delivery failures remain visible; uncertain deliveries are not
            automatically retried.
          </p>
        </Card>
        {error || query.isError || members.isError ? (
          <p role="alert">{error || 'Unable to load schedules or recipients.'}</p>
        ) : null}
        {query.isLoading ? (
          <p>Loading schedules...</p>
        ) : query.data?.schedules.length === 0 ? (
          <p>No schedules in this scope yet.</p>
        ) : (
          query.data?.schedules.map((schedule) => (
            <Card key={schedule.id}>
              <h2 className="text-lg font-semibold">
                {schedule.title} · {schedule.enabled ? 'Enabled' : 'Disabled'}
              </h2>
              <p>
                {schedule.kind === 'REMINDER'
                  ? new Date(schedule.dueAt!).toLocaleString()
                  : `Monthly day ${schedule.deliveryDay}, ${schedule.deliveryHour}:${String(schedule.deliveryMinute).padStart(2, '0')} (${schedule.timezone})`}
              </p>
              <Button variant="ghost" onClick={() => edit(schedule)}>
                Edit
              </Button>
              <Button variant="ghost" onClick={() => void toggle(schedule)}>
                {schedule.enabled ? 'Disable' : 'Enable'}
              </Button>
              <ul>
                {schedule.deliveries.map((delivery) => (
                  <li key={delivery.id}>
                    {delivery.periodKey}: {delivery.status} · attempts {delivery.attempts}
                    {delivery.errorCode ? ` · ${delivery.errorCode}` : ''}
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
