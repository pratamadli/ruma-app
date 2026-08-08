'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Dialog,
  Input,
  Label,
  Nav,
  NavLink,
  RumaBrand,
  RumaLockup,
  RumaMark,
  Select,
} from '@ruma/ui';

export default function DesignSystemPage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-4xl gap-8 px-6 py-10">
      <Nav>
        <Link href="/" className="mr-auto no-underline" aria-label="RUMA home">
          <RumaBrand />
        </Link>
        <NavLink href="/app">App shell</NavLink>
        <NavLink href="/sign-in">Sign in</NavLink>
      </Nav>

      <header className="grid gap-3">
        <p className="m-0 text-xs uppercase tracking-[0.18em] text-[var(--ruma-color-ink-muted)]">
          Soft UI Evolution · Swiss structure
        </p>
        <h1 className="m-0 text-4xl font-semibold tracking-tight">Design system foundation</h1>
        <p className="m-0 max-w-2xl text-[var(--ruma-color-ink-muted)]">
          Warm ivory surfaces, charcoal ink, muted sage accent, restrained elevation. This page
          verifies primitives before product UI lands.
        </p>
      </header>

      <section className="grid gap-4">
        <Card>
          <CardTitle>Brand</CardTitle>
          <CardDescription>
            Geometric R + house mark, sage door accent, open-A wordmark. Favicon uses mark without
            door.
          </CardDescription>
          <div className="mt-6 flex flex-wrap items-end gap-8">
            <div className="grid gap-2">
              <RumaMark className="h-16 w-16" />
              <span className="text-xs text-[var(--ruma-color-ink-muted)]">Mark</span>
            </div>
            <div className="grid gap-2">
              <RumaMark className="h-16 w-16" showDoor={false} />
              <span className="text-xs text-[var(--ruma-color-ink-muted)]">Mark mono</span>
            </div>
            <div className="grid gap-2">
              <RumaBrand />
              <span className="text-xs text-[var(--ruma-color-ink-muted)]">Nav lockup</span>
            </div>
            <div className="grid gap-2">
              <RumaLockup withTagline />
              <span className="text-xs text-[var(--ruma-color-ink-muted)]">Marketing</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Primary actions stay calm and confident.</CardDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Form controls</CardTitle>
          <CardDescription>Clear labels, soft depth, accessible focus.</CardDescription>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="demo-input">Household name</Label>
              <Input id="demo-input" placeholder="The Rivets" />
            </div>
            <div>
              <Label htmlFor="demo-select">Assign to</Label>
              <Select id="demo-select" defaultValue="">
                <option value="">Anyone</option>
                <option value="a">Adli</option>
                <option value="b">Partner</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="demo-date">Due date</Label>
              <Input id="demo-date" type="date" />
            </div>
            <div>
              <Label htmlFor="demo-datetime">Starts</Label>
              <Input id="demo-datetime" type="datetime-local" />
            </div>
            <div className="sm:col-span-2">
              <Button variant="secondary" onClick={() => setOpen(true)}>
                Open dialog
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardTitle>Bento sample</CardTitle>
          <CardDescription>Selective dashboard composition — not every page.</CardDescription>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--ruma-radius-md)] bg-[var(--ruma-color-accent-soft)] p-4">
              Calm overview tile
            </div>
            <div className="rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] p-4">
              Hierarchy tile
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle>Tokens</CardTitle>
          <CardDescription>Ivory · charcoal · sage · gold</CardDescription>
          <div className="mt-4 flex gap-2">
            <span className="h-10 w-10 rounded-full bg-[var(--ruma-color-surface)] ring-1 ring-black/10" />
            <span className="h-10 w-10 rounded-full bg-[var(--ruma-color-ink)]" />
            <span className="h-10 w-10 rounded-full bg-[var(--ruma-color-accent)]" />
            <span className="h-10 w-10 rounded-full bg-[var(--ruma-color-gold)]" />
          </div>
        </Card>
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Restrained dialog"
        description="Glass is reserved for special overlays — this stays soft and clear."
        footer={<Button onClick={() => setOpen(false)}>Done</Button>}
      >
        <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
          Use dialogs for focused confirmation, not dense workflows.
        </p>
      </Dialog>

      <p className="text-sm text-[var(--ruma-color-ink-muted)]">
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
