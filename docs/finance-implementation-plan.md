# Finance platform implementation plan

## Phase 0 audit

The current application is a pnpm 10 / Turborepo modular monolith: Next.js App
Router, React, TanStack Query, Redux session state and shared `@ruma/ui` controls;
NestJS, shared Zod validation, Prisma and PostgreSQL. IDs are ULIDs. Authentication
uses short-lived bearer tokens and rotating HTTP-only refresh cookies.
`FamilyMemberGuard` verifies active membership and returns 404 across tenants.
Family is the existing household aggregate; do not introduce another household.

Existing modules include tasks, groceries, calendar, per-recipient notifications
and household activity. Finance already has accounts, categories, manual ledger
entries, monthly budgets, deterministic intelligence and reviewed email imports.
Money uses bigint minor units (IDR = rupiah), serialized as decimal strings.
Transfers are one row with two accounts. Transactions are soft-deleted.
Account `ownerUserId` is currently a display label, **not** a privacy boundary.
All current finance records are household-visible.

The web already provides finance overview, accounts, transactions, categories,
budgets and import review pages. Preserve their navigation and ivory/charcoal/sage
design. Finance remains a module of the Household OS, not a replacement product.

Vitest covers unit rules and Supertest API integration; database tests require
`DATABASE_URL`. There is no existing browser E2E suite. Commands: `pnpm test`,
`pnpm typecheck`, `pnpm lint`, `pnpm build`. On Windows use `pnpm.cmd` if the
PowerShell shim is blocked. Dependencies were initially absent.

Deployment is Vercel web with same-origin `/v1` proxy to Railway API/PostgreSQL.
Prisma migrations run before deployment. No Docker, object-storage abstraction,
scheduler, Telegram binding or Hermes integration currently exists.

## Gap and implementation sequence

| Phase | Changes and verification gate                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Add explicit scope/ownership and payer, preserve household defaults, enforce account/scope/currency compatibility, add investment ledger types, audit and idempotency. Test privacy, amount/date validation and accounting. |
| 2     | Extend existing web workflows with explicit scope, pagination and payer display. Keep loading/error/empty states and confirmation.                                                                                          |
| 3     | Scope monthly budgets, add income/savings/investment allocations and manually maintained goals. Actual spending remains ledger-derived.                                                                                     |
| 4     | Add one-time Telegram linking and revocation, authenticated service tools, expiring drafts and trusted Telegram callback confirmation. Test retries, expiry and isolation.                                                  |
| 5     | Add private receipt storage and a replaceable extraction adapter, validation, duplicate detection and correction/review. Extraction never posts ledger data.                                                                |
| 6     | Add manual investments/valuations and scoped reminders/monthly reports with durable delivery records. Verify recipient isolation and job idempotency.                                                                       |

Each phase is implemented only after the preceding verification gate. Shared
contracts live in `packages/types` and `packages/validation`; backend changes stay
under `apps/api/src/finance`; web changes extend existing finance routes. Database
changes extend the existing schema using additive migrations. Integration and
deployment instructions belong in the finance module documentation and ADR-015.

## Compatibility, risks and safe assumptions

- Backfill existing accounts, transactions and budgets as HOUSEHOLD. Never infer
  privacy from the old account owner label or transaction creator.
- New personal records are private to the authenticated creator within the active
  family. Family membership remains mandatory, including personal finance access.
- Scope is immutable after creation. Use accounts of the same scope for ledger
  operations; do not expose a personal account through a shared transaction.
- Categories remain a shared household taxonomy, with no balances or personal
  records attached to their API representation.
- IDR is the supported currency for new writes; no FX or mixed-currency totals.
  Existing historical data is preserved. Any non-IDR historical data needs
  operator review before enabling aggregate finance reporting.
- Finance audits are separate from household activity and do not contain amounts,
  descriptions, receipt contents or account numbers.
- Shared records are readable/writable by active members, following existing
  permissions. Personal ownership never grants access to another member.
- Telegram usernames are not identities. Hermes can prepare drafts but cannot
  manufacture approval; only a verified Telegram callback or signed-in web user
  can authorize a specific pending draft.
- No OCR/provider credentials or production database are assumed available.
  Unconfigured integrations must explicitly report unavailable, never fake success.
- Without existing object storage, use a private filesystem adapter configured on
  a persistent API volume. Never serve its directory statically.
- Provider delivery cannot be guaranteed exactly once across an ambiguous remote
  timeout. Persist attempts and avoid automatic retries of uncertain deliveries.
- Manual goal progress and investment valuations are snapshots, not consumption
  expenses or additional ledger contributions.
- No bank/broker sync, live prices, autonomous purchases, FX, tax engine or
  microservice infrastructure is introduced.

## Release validation

Run targeted tests after each phase, then workspace checks. Validate additive
migrations against a disposable local database only; never migrate an unknown
database. Explicitly distinguish skipped database tests and adapter tests from
live integrations in the implementation report. External setup and remaining
limitations must be documented before claiming release readiness.
