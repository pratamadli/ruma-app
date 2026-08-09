'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label, Select } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { BudgetProgressRow } from '@/components/budget-progress';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import {
  archiveFinanceBudget,
  createFinanceBudget,
  getFinanceBudget,
  listFinanceCategories,
  updateFinanceBudget,
} from '@/lib/api';
import { currentMonth, formatIdr, monthLabel, parseIdrInput, shiftMonth } from '@/lib/money';

type DraftItem = { categoryId: string; amount: string };

export default function FinanceBudgetsPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [editing, setEditing] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ categoryId: '', amount: '' }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budgetQuery = useQuery({
    queryKey: ['finance-budget', familyId, month, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getFinanceBudget(accessToken!, familyId, month),
  });
  const categoriesQuery = useQuery({
    queryKey: ['finance-categories', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceCategories(accessToken!, familyId),
  });

  const expenseCategories = useMemo(
    () =>
      (categoriesQuery.data?.categories ?? []).filter((c) => c.kind === 'EXPENSE' && c.isActive),
    [categoriesQuery.data],
  );

  const budget = budgetQuery.data?.budget ?? null;

  function startCreate() {
    setTotalAmount('');
    setItems([{ categoryId: '', amount: '' }]);
    setEditing(true);
    setError(null);
  }

  function startEdit() {
    if (!budget) return;
    setTotalAmount(budget.household?.budgetMinor ?? '');
    setItems(
      budget.items.length > 0
        ? budget.items.map((item) => ({
            categoryId: item.categoryId,
            amount: item.budgetMinor,
          }))
        : [{ categoryId: '', amount: '' }],
    );
    setEditing(true);
    setError(null);
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['finance-budget', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['finance-summary', familyId] });
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

    const totalParsed = totalAmount.trim() === '' ? null : parseIdrInput(totalAmount);
    if (totalAmount.trim() !== '' && totalParsed == null) {
      setError('Enter a valid household budget amount.');
      return;
    }

    const parsedItems: Array<{ categoryId: string; amountMinor: string }> = [];
    for (const item of items) {
      if (!item.categoryId && !item.amount.trim()) continue;
      if (!item.categoryId) {
        setError('Choose a category for each budget line.');
        return;
      }
      const amountMinor = parseIdrInput(item.amount);
      if (amountMinor == null) {
        setError('Enter valid category budget amounts.');
        return;
      }
      parsedItems.push({ categoryId: item.categoryId, amountMinor });
    }

    if (totalParsed == null && parsedItems.length === 0) {
      setError('Add a household total and/or at least one category.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (budget) {
        await updateFinanceBudget(accessToken, familyId, budget.id, {
          totalAmountMinor: totalParsed,
          items: parsedItems,
          status: 'ACTIVE',
        });
      } else {
        await createFinanceBudget(accessToken, familyId, {
          periodMonth: month,
          totalAmountMinor: totalParsed,
          items: parsedItems,
        });
      }
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save budget');
    } finally {
      setPending(false);
    }
  }

  async function onArchive() {
    if (!accessToken || !budget) return;
    if (!window.confirm('Archive this month’s budget? Transactions stay unchanged.')) return;
    await archiveFinanceBudget(accessToken, familyId, budget.id);
    setEditing(false);
    await refresh();
  }

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="grid gap-1">
            <h1 className="m-0 text-3xl font-semibold tracking-tight">Budgets</h1>
            <p className="m-0 text-[var(--ruma-color-ink-muted)]">
              Plan spending, then see what is left.
            </p>
          </div>
          <FinanceSubnav familyId={familyId} />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-1.5 text-sm"
              onClick={() => {
                setMonth((m) => shiftMonth(m, -1));
                setEditing(false);
              }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="m-0 text-sm font-medium">{monthLabel(month)}</p>
            <button
              type="button"
              className="rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-1.5 text-sm"
              onClick={() => {
                setMonth((m) => shiftMonth(m, 1));
                setEditing(false);
              }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </header>

        {budgetQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading budget…</p>
        ) : budgetQuery.isError ? (
          <p className="text-[var(--ruma-color-danger)]">Unable to load budget.</p>
        ) : editing ? (
          <Card>
            <form className="grid gap-4" onSubmit={onSave}>
              <div className="grid gap-1.5 sm:max-w-xs">
                <Label htmlFor="budget-total">Household budget (optional)</Label>
                <Input
                  id="budget-total"
                  inputMode="numeric"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="8.000.000"
                />
              </div>

              <div className="grid gap-3">
                <p className="m-0 text-sm font-medium">Category budgets</p>
                {items.map((item, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                    <Select
                      aria-label={`Category ${index + 1}`}
                      value={item.categoryId}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...item, categoryId: e.target.value };
                        setItems(next);
                      }}
                    >
                      <option value="">Select category…</option>
                      {expenseCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      inputMode="numeric"
                      aria-label={`Amount ${index + 1}`}
                      value={item.amount}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...item, amount: e.target.value };
                        setItems(next);
                      }}
                      placeholder="2.000.000"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                      disabled={items.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setItems([...items, { categoryId: '', amount: '' }])}
                >
                  Add category
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : budget ? 'Save changes' : 'Create budget'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
              {error ? (
                <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p>
              ) : null}
            </form>
          </Card>
        ) : !budget ? (
          <Card>
            <CardTitle>No budget for {monthLabel(month)}</CardTitle>
            <CardDescription>
              Set a household ceiling and a few category limits — keep it light.
            </CardDescription>
            <div className="mt-4">
              <Button size="sm" onClick={startCreate}>
                Create budget
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {budget.status === 'ARCHIVED' ? (
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                This budget is archived. Edit to restore it for planning.
              </p>
            ) : null}

            {budget.household ? (
              <section className="grid gap-2">
                <h2 className="m-0 text-lg font-semibold">Household</h2>
                <BudgetProgressRow
                  title="Total spending plan"
                  budgetMinor={budget.household.budgetMinor}
                  spentMinor={budget.household.spentMinor}
                  remainingMinor={budget.household.remainingMinor}
                  percentage={budget.household.percentage}
                  status={budget.household.status}
                />
              </section>
            ) : (
              <section className="grid gap-1">
                <h2 className="m-0 text-lg font-semibold">Household</h2>
                <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                  No household ceiling — spent {formatIdr(budget.expenseTotalMinor)} this month.
                </p>
              </section>
            )}

            <section className="grid gap-4">
              <h2 className="m-0 text-lg font-semibold">Categories</h2>
              {budget.items.length === 0 ? (
                <p className="m-0 text-[var(--ruma-color-ink-muted)]">No category budgets yet.</p>
              ) : (
                budget.items.map((item) => (
                  <BudgetProgressRow
                    key={item.id}
                    title={item.categoryName}
                    budgetMinor={item.budgetMinor}
                    spentMinor={item.spentMinor}
                    remainingMinor={item.remainingMinor}
                    percentage={item.percentage}
                    status={item.status}
                    compact
                  />
                ))
              )}
            </section>

            {budget.alerts.length > 0 ? (
              <section className="grid gap-2">
                <h2 className="m-0 text-lg font-semibold">Alerts</h2>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {budget.alerts.map((alert, index) => (
                    <li
                      key={`${alert.categoryId ?? 'hh'}-${index}`}
                      className="text-sm text-[var(--ruma-color-ink-muted)]"
                    >
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={startEdit}>
                Edit budget
              </Button>
              {budget.status === 'ACTIVE' ? (
                <Button size="sm" variant="ghost" onClick={() => void onArchive()}>
                  Archive
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
