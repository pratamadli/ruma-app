# RUMA Roadmap

## Phase 0 — Foundation

**Status: COMPLETE**

Repository, monorepo, authentication foundation (email/password + JWT/refresh + password reset), database, deployment, design system, CI/CD, observability (requestId, JSON logs, Sentry env-gated).

## Phase 1 — Family & Household MVP

**Status: COMPLETE**

Family workspace + household collaboration:

- Family, members, invitations, activity feed
- Tasks / chores
- Shared grocery list
- Family calendar (agenda)
- In-app notifications
- Household dashboard overview

Implemented as the reusable pattern: **Family → Household resources → Activity → Notification**.

### Deferred (intentionally not blocking Phase 2)

See [ADR-009](./adr/009-phase01-deferred-engineering.md):

- Magic link
- Google OAuth
- PostHog
- Notification reminder jobs (due soon / overdue / upcoming events)
- Recurring task auto-spawn
- Full server-side timezone conversion engine
- OpenAPI
- Playwright E2E suite
- WebSockets / realtime infra

## Phase 2 — Home Management

Home profile, rooms, assets, maintenance, documents, knowledge hub, service contacts.

## Phase 3 — Finance

Transactions, bills, budgets, savings, debt, insurance, investments, net worth.

## Phase 4 — Smart Finance

Email ingestion, transaction extraction, categorization, monthly reports, AI insights.

## Phase 5 — RUMA AI

Household assistant, recommendations, smart reminders, predictions.

## Phase 6 — Complete RUMA

OCR, pantry, family goals, travel, profiles, subscriptions, integrations, admin.
