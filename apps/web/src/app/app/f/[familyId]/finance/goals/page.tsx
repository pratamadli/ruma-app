'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label } from '@ruma/ui';
import type { FinanceGoalResponse } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { FinanceScopePicker, useFinanceScope } from '@/components/finance-scope';
import { useAuth } from '@/lib/auth-context';
import { createFinanceGoal, listFinanceGoals, updateFinanceGoal } from '@/lib/api';
import { formatIdr, parseIdrInput } from '@/lib/money';

export default function GoalsPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { accessToken } = useAuth();
  const { scope } = useFinanceScope();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [progress, setProgress] = useState('0');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ['finance-goals', familyId, scope, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listFinanceGoals(accessToken!, familyId, scope),
  });
  function edit(goal: FinanceGoalResponse) {
    setEditing(goal.id);
    setName(goal.name);
    setTarget(goal.targetAmountMinor);
    setProgress(goal.currentAmountMinor);
    setDate(goal.targetDate ?? '');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const targetAmountMinor = parseIdrInput(target),
      currentAmountMinor = parseIdrInput(progress);
    if (!targetAmountMinor || targetAmountMinor === '0' || currentAmountMinor == null) {
      setError('Enter valid target and progress amounts.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const input = { name, targetAmountMinor, currentAmountMinor, targetDate: date || null };
      if (editing) await updateFinanceGoal(accessToken, familyId, editing, input);
      else await createFinanceGoal(accessToken, familyId, { ...input, scope });
      setEditing(null);
      setName('');
      setTarget('');
      setProgress('0');
      setDate('');
      await client.invalidateQueries({ queryKey: ['finance-goals', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save goal');
    } finally {
      setPending(false);
    }
  }
  async function setStatus(id: string, status: 'ARCHIVED' | 'COMPLETED') {
    if (
      !accessToken ||
      !window.confirm(`${status === 'ARCHIVED' ? 'Archive' : 'Complete'} this goal?`)
    )
      return;
    try {
      await updateFinanceGoal(accessToken, familyId, id, { status });
      await client.invalidateQueries({ queryKey: ['finance-goals', familyId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update goal');
    }
  }
  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <h1 className="text-3xl font-semibold">Goals</h1>
          <FinanceSubnav familyId={familyId} />
          <FinanceScopePicker
            onChange={() => {
              setEditing(null);
              setName('');
              setTarget('');
              setProgress('0');
            }}
          />
        </header>
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="goal-name">Goal name</Label>
              <Input
                id="goal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="goal-target">Target amount</Label>
              <Input
                id="goal-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>
            <div>
              <Label htmlFor="goal-progress">Current progress (manual)</Label>
              <Input
                id="goal-progress"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>
            <div>
              <Label htmlFor="goal-date">Target date (optional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button disabled={pending}>
              {pending ? 'Saving...' : editing ? 'Update goal' : 'Create goal'}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel edit
              </Button>
            ) : null}
          </form>
          <p className="text-sm text-[var(--ruma-color-ink-muted)]">
            Progress is a manual snapshot. Saving it does not move money or create expenses.
          </p>
        </Card>
        {error || query.isError ? (
          <p role="alert" className="text-[var(--ruma-color-danger)]">
            {error || query.error?.message}
          </p>
        ) : null}
        {query.isLoading ? (
          <p>Loading goals...</p>
        ) : query.data?.goals.length === 0 ? (
          <p>No goals in this scope yet.</p>
        ) : (
          query.data?.goals.map((goal) => (
            <Card key={goal.id}>
              <h2 className="text-lg font-semibold">{goal.name}</h2>
              <p>
                {formatIdr(goal.currentAmountMinor)} of {formatIdr(goal.targetAmountMinor)} ·{' '}
                {goal.status}
              </p>
              {goal.targetDate ? <p>Target: {goal.targetDate}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => edit(goal)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => void setStatus(goal.id, 'COMPLETED')}>
                  Complete
                </Button>
                <Button variant="ghost" onClick={() => void setStatus(goal.id, 'ARCHIVED')}>
                  Archive
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
