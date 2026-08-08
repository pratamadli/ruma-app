# RUMA Roadmap

**Product version:** `2.0.0` (see root / `apps/web` / `apps/api` `package.json`)

## Phase 0 — Foundation

**Status: COMPLETE** (`1.1.x`)

Repository, monorepo, authentication foundation (email/password + JWT/refresh + password reset), database, deployment, design system, CI/CD, observability (requestId, JSON logs, Sentry env-gated).

## Phase 1 — Family & Household MVP

**Status: COMPLETE** (`1.1.x`)

Family workspace + household collaboration:

- Family, members, invitations, activity feed
- Tasks / chores
- Shared grocery list
- Family calendar (agenda)
- In-app notifications
- Household dashboard overview

Implemented as the reusable pattern: **Family → Household resources → Activity → Notification**.

### Deferred from Phase 0/1

See [ADR-009](./adr/009-phase01-deferred-engineering.md):

- Magic link, Google OAuth, PostHog
- Notification reminder jobs
- Recurring task auto-spawn
- OpenAPI, Playwright E2E, WebSockets

## Phase 2 — Household Finance

**Status: Phase 2A COMPLETE** (`2.0.0`)

Financial source of truth for the household. Sensitive domain — family-scoped, no leakage into generic activity/notifications. See [ADR-010](./adr/010-household-finance-phase2a.md) and [modules/finance](./modules/finance/README.md).

### Phase 2A — Manual Finance Foundation (COMPLETE)

- Accounts, categories, manual transactions
- Transfers (excluded from expense totals)
- Balances, filtering, monthly summary, Finance dashboard

### Phase 2B — Budgeting (later)

- Monthly / category budgets, progress, alerts

### Phase 2C — Financial Intelligence Foundation (later)

- Recurring detection, anomalies, trends, MoM comparison

### Phase 2D — Automatic Transaction Capture (later)

- Email ingestion, parser, AI categorization, confirmation workflow

## Phase 3 — Home Management

Home profile, rooms, assets, maintenance, documents, knowledge hub, service contacts.

## Phase 4 — Smart Finance extensions

Deeper automation and reporting building on Phase 2 (bills, goals, richer insights) — without replacing the Phase 2A ledger.

## Phase 5 — RUMA AI

Household assistant, recommendations, smart reminders, predictions.

## Phase 6 — Complete RUMA

OCR, pantry, family goals, travel, profiles, subscriptions, integrations, admin.
