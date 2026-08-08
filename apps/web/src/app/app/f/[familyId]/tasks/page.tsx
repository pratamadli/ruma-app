'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { createTask, listMembers, listTasks, updateTask } from '@/lib/api';
import type { TaskResponse } from '@ruma/types';

function isToday(dueDate: string | null) {
  if (!dueDate) return false;
  return dueDate === new Date().toISOString().slice(0, 10);
}

export default function TasksPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('open');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ['tasks', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listTasks(accessToken!, familyId),
  });
  const membersQuery = useQuery({
    queryKey: ['members', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listMembers(accessToken!, familyId),
  });

  const { user } = useAuth();
  const filtered = useMemo(() => {
    const tasks = tasksQuery.data?.tasks ?? [];
    return tasks.filter((task) => {
      if (filter === 'open') return task.status !== 'COMPLETED';
      if (filter === 'mine') return task.assignedTo?.id === user?.id && task.status !== 'COMPLETED';
      return true;
    });
  }, [tasksQuery.data, filter, user?.id]);

  const today = filtered.filter((task) => isToday(task.dueDate) || !task.dueDate);
  const upcoming = filtered.filter((task) => task.dueDate && !isToday(task.dueDate));

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !title.trim()) return;
    setPending(true);
    setError(null);
    try {
      await createTask(accessToken, familyId, {
        title: title.trim(),
        assignedToId: assignee || null,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDueDate('');
      await queryClient.invalidateQueries({ queryKey: ['tasks', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['activity', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create task');
    } finally {
      setPending(false);
    }
  }

  async function toggleComplete(task: TaskResponse) {
    if (!accessToken) return;
    await updateTask(accessToken, familyId, task.id, {
      status: task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
    });
    await queryClient.invalidateQueries({ queryKey: ['tasks', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['activity', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  function TaskRow({ task }: { task: TaskResponse }) {
    const done = task.status === 'COMPLETED';
    return (
      <li className="flex list-none items-start gap-3 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-3">
        <button
          type="button"
          aria-label={done ? 'Mark incomplete' : 'Complete task'}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${done ? 'border-[var(--ruma-color-accent)] bg-[var(--ruma-color-accent-soft)]' : 'border-[var(--ruma-color-border)]'}`}
          onClick={() => void toggleComplete(task)}
        >
          {done ? '✓' : ''}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={`font-medium ${done ? 'text-[var(--ruma-color-ink-muted)] line-through' : ''}`}
          >
            {task.title}
          </div>
          <div className="mt-1 text-sm text-[var(--ruma-color-ink-muted)]">
            {task.dueDate ? `Due ${task.dueDate}` : 'No due date'}
            {task.assignedTo ? ` · ${task.assignedTo.name ?? task.assignedTo.email}` : ''}
            {task.recurrence !== 'NONE' ? ` · ${task.recurrence.toLowerCase()}` : ''}
          </div>
        </div>
      </li>
    );
  }

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-2">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="m-0 text-[var(--ruma-color-ink-muted)]">
            Household chores — simple and shared.
          </p>
        </header>

        <Card>
          <CardTitle>Add a task</CardTitle>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={onCreate}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pay electricity bill"
              required
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add'}
            </Button>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="assignee">Assign to</Label>
                <select
                  id="assignee"
                  className="w-full rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] bg-white px-3 py-2 text-sm"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Anyone</option>
                  {(membersQuery.data?.members ?? []).map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name ?? member.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="due">Due date</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            {error ? (
              <p className="m-0 text-sm text-[var(--ruma-color-danger)] sm:col-span-2">{error}</p>
            ) : null}
          </form>
        </Card>

        <div className="flex flex-wrap gap-2">
          {(['open', 'mine', 'all'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? 'primary' : 'ghost'}
              onClick={() => setFilter(value)}
            >
              {value === 'open' ? 'Open' : value === 'mine' ? 'Mine' : 'All'}
            </Button>
          ))}
        </div>

        {tasksQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading tasks…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardTitle>No tasks yet</CardTitle>
            <CardDescription>Add the first household chore above.</CardDescription>
          </Card>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-3">
              <h2 className="m-0 text-lg font-semibold">Today</h2>
              <ul className="grid gap-2 p-0">
                {today.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            </section>
            {upcoming.length > 0 ? (
              <section className="grid gap-3">
                <h2 className="m-0 text-lg font-semibold">Upcoming</h2>
                <ul className="grid gap-2 p-0">
                  {upcoming.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
