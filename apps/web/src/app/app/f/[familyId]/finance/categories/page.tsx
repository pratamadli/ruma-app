'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, Select } from '@ruma/ui';
import type { CategoryKind } from '@ruma/types';
import { AppShell } from '@/components/app-shell';
import { FinanceSubnav } from '@/components/finance-subnav';
import { useAuth } from '@/lib/auth-context';
import { createFinanceCategory, listFinanceCategories, updateFinanceCategory } from '@/lib/api';

export default function FinanceCategoriesPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('EXPENSE');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['finance-categories', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => listFinanceCategories(accessToken!, familyId),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['finance-categories', familyId] });
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      await createFinanceCategory(accessToken, familyId, { name: name.trim(), kind });
      setName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category');
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(categoryId: string, isActive: boolean) {
    if (!accessToken) return;
    await updateFinanceCategory(accessToken, familyId, categoryId, { isActive: !isActive });
    await refresh();
  }

  const categories = categoriesQuery.data?.categories ?? [];
  const income = categories.filter((c) => c.kind === 'INCOME');
  const expense = categories.filter((c) => c.kind === 'EXPENSE');

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="grid gap-1">
            <h1 className="m-0 text-3xl font-semibold tracking-tight">Categories</h1>
            <p className="m-0 text-[var(--ruma-color-ink-muted)]">
              Keep spending readable. Deactivate instead of deleting history.
            </p>
          </div>
          <FinanceSubnav familyId={familyId} />
        </header>

        <Card>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
            onSubmit={onCreate}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kids activities"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category-kind">Type</Label>
              <Select
                id="category-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as CategoryKind)}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </Select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? '…' : 'Add'}
            </Button>
          </form>
          {error ? (
            <p className="mt-3 mb-0 text-sm text-[var(--ruma-color-danger)]">{error}</p>
          ) : null}
        </Card>

        {categoriesQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading categories…</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            <CategoryGroup
              title="Expenses"
              items={expense}
              onToggle={(id, active) => void toggleActive(id, active)}
            />
            <CategoryGroup
              title="Income"
              items={income}
              onToggle={(id, active) => void toggleActive(id, active)}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CategoryGroup({
  title,
  items,
  onToggle,
}: {
  title: string;
  items: Array<{ id: string; name: string; isActive: boolean; isSystem: boolean }>;
  onToggle: (id: string, isActive: boolean) => void;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span
              className={item.isActive ? '' : 'text-[var(--ruma-color-ink-muted)] line-through'}
            >
              {item.name}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onToggle(item.id, item.isActive)}>
              {item.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
