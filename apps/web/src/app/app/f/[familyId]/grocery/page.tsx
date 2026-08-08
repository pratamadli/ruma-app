'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import {
  addGroceryItem,
  clearCompletedGrocery,
  deleteGroceryItem,
  getGrocery,
  updateGroceryItem,
} from '@/lib/api';

export default function GroceryPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groceryQuery = useQuery({
    queryKey: ['grocery', familyId, accessToken],
    enabled: Boolean(accessToken && familyId),
    queryFn: () => getGrocery(accessToken!, familyId),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['grocery', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] });
    await queryClient.invalidateQueries({ queryKey: ['activity', familyId] });
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      await addGroceryItem(accessToken, familyId, {
        name: name.trim(),
        quantity: quantity.trim() || undefined,
      });
      setName('');
      setQuantity('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add item');
    } finally {
      setPending(false);
    }
  }

  const items = groceryQuery.data?.items ?? [];
  const open = items.filter((item) => !item.isCompleted);
  const done = items.filter((item) => item.isCompleted);

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header className="grid gap-2">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Grocery</h1>
          <p className="m-0 text-[var(--ruma-color-ink-muted)]">
            Shared list — add and check items in one tap.
          </p>
        </header>

        <Card>
          <form className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]" onSubmit={onAdd}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Milk"
              required
              autoFocus
            />
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="× 12"
            />
            <Button type="submit" disabled={pending}>
              {pending ? '…' : 'Add'}
            </Button>
          </form>
          {error ? (
            <p className="mt-3 mb-0 text-sm text-[var(--ruma-color-danger)]">{error}</p>
          ) : null}
        </Card>

        {groceryQuery.isLoading ? (
          <p className="text-[var(--ruma-color-ink-muted)]">Loading grocery list…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardTitle>Your grocery list is empty</CardTitle>
            <CardDescription>Add milk, eggs, or whatever the house needs.</CardDescription>
          </Card>
        ) : (
          <div className="grid gap-6">
            <ul className="grid gap-2 p-0">
              {open.map((item) => (
                <li
                  key={item.id}
                  className="flex list-none items-center gap-3 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-3"
                >
                  <button
                    type="button"
                    aria-label={`Check ${item.name}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--ruma-color-border)]"
                    onClick={async () => {
                      if (!accessToken) return;
                      await updateGroceryItem(accessToken, familyId, item.id, {
                        isCompleted: true,
                      });
                      await refresh();
                    }}
                  />
                  <div className="min-w-0 flex-1 font-medium">
                    {item.name}
                    {item.quantity ? (
                      <span className="text-[var(--ruma-color-ink-muted)]"> · {item.quantity}</span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!accessToken) return;
                      await deleteGroceryItem(accessToken, familyId, item.id);
                      await refresh();
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>

            {done.length > 0 ? (
              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-lg font-semibold text-[var(--ruma-color-ink-muted)]">
                    Completed
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!accessToken) return;
                      await clearCompletedGrocery(accessToken, familyId);
                      await refresh();
                    }}
                  >
                    Clear completed
                  </Button>
                </div>
                <ul className="grid gap-2 p-0">
                  {done.map((item) => (
                    <li
                      key={item.id}
                      className="flex list-none items-center gap-3 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-3 opacity-70"
                    >
                      <button
                        type="button"
                        aria-label={`Uncheck ${item.name}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--ruma-color-accent)] bg-[var(--ruma-color-accent-soft)]"
                        onClick={async () => {
                          if (!accessToken) return;
                          await updateGroceryItem(accessToken, familyId, item.id, {
                            isCompleted: false,
                          });
                          await refresh();
                        }}
                      >
                        ✓
                      </button>
                      <div className="flex-1 font-medium line-through text-[var(--ruma-color-ink-muted)]">
                        {item.name}
                      </div>
                    </li>
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
