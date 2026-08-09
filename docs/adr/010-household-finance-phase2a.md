# ADR-010: Household Finance Phase 2A foundations

## Status

Accepted

## Context

Phase 2A introduces Accounts, Transactions, Categories, Transfers, and monthly summary under Family tenancy. Financial data is more sensitive than Tasks/Grocery/Calendar. We need durable decisions for money representation, transfers, deletion, privacy, and dates before schema lands.

## Decisions

### 1. Money representation — integer minor units (`BIGINT`)

- Store amounts as **non-negative integer minor units** (`amountMinor` / `initialBalanceMinor` as Prisma `BigInt` → PostgreSQL `BIGINT`).
- For **IDR**, the minor unit is **1 rupiah** (scale 0). Future currencies (e.g. USD cents, scale 2) stay compatible without schema redesign.
- API JSON exposes amounts as **decimal strings** (`"150000"`), never IEEE-754 floats.
- Reject non-integers, negatives, NaN/Infinity, and values above a safe maximum.

**Rejected:** Prisma `Decimal` for application math — workable, but integer minor units are simpler, deterministic, and avoid decimal-library edge cases in Node/Nest.

### 2. Transfer modeling — single row with two accounts

- One `Transaction` with `type = TRANSFER`, `accountId` = source, `transferAccountId` = destination.
- Amount is always positive; direction is implied by source → destination.
- **Transfers are excluded** from income, expense, and net cash-flow summaries.
- Balance impact: source − amount, destination + amount.

**Rejected:** Paired IN/OUT legs (double rows) for Phase 2A — more bookkeeping surface for the same household UX.

### 3. Deletion — soft delete for transactions; deactivate for accounts/categories

- Transactions: set `deletedAt` (excluded from balances and summaries). No hard delete in Phase 2A.
- Accounts / categories: `isActive = false` (and accounts may also soft-delete later). Categories with history must not be hard-deleted.
- Rationale: reporting integrity and future intelligence / imports.

### 4. Privacy — no finance leakage into household Activity / Notifications

- Do **not** write transaction amounts, descriptions, or account identifiers into `FamilyActivity` or `Notification`.
- Phase 2A emits **no** finance notifications.
- Sentry scrubbing extends to finance field names (`amount`, `balance`, `account`, etc.).

### 5. Transaction dates — calendar `DATE`

- `transactionDate` is PostgreSQL `DATE` (`YYYY-MM-DD`), same pattern as `Task.dueDate`.
- A transaction dated August 1 stays August 1 regardless of browser timezone.
- Monthly summary filters by calendar month on `transactionDate`.

### 6. Tenancy & authorization

- All finance resources are `familyId`-scoped.
- Endpoints use existing `AuthGuard` + `FamilyMemberGuard`.
- Cross-tenant access → **404** (RUMA convention).
- Optional account `ownerUserId` is UX-only; the family remains the tenant.

### 7. Future import compatibility

- `source` defaults to `MANUAL` (`IMPORT` reserved).
- Optional `sourceReference` / `confidence` columns exist for later email/AI capture without a second transaction entity.

## Consequences

- Phase 2A can ship a trustworthy ledger without Redis, workers, or event sourcing.
- Phase 2B budgets and 2D imports attach to the same `Transaction` model.
- Home Management (former roadmap Phase 2) is deferred behind Finance per product priority.
