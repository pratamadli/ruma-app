# ADR-011: Household Budgeting Phase 2B

## Status

Accepted

## Context

Phase 2A provides the ledger (accounts, transactions, categories). Phase 2B adds planned spending vs actual spending for a calendar month without turning RUMA into accounting software.

## Decisions

### 1. Period — one budget per family per calendar month

- Period stored as `periodMonth` (`YYYY-MM`, CHAR(7)).
- Unique `(familyId, periodMonth)`.
- No weekly/custom ranges in Phase 2B.

### 2. Model — `Budget` + `BudgetItem`

- `Budget.totalAmountMinor` is an **optional** household spending ceiling (nullable).
- `BudgetItem` links to existing `TransactionCategory` (EXPENSE only); amount in minor units.
- Unique `(budgetId, categoryId)` — no duplicate category lines.
- Total is **not** derived from items (families may set a household ceiling independently of category envelopes).

### 3. Spent — derived from Phase 2A expenses only

```text
spent(category) = SUM(amountMinor) where type=EXPENSE, categoryId, month, deletedAt null
spent(household) = SUM(amountMinor) where type=EXPENSE, month, deletedAt null
```

Income and transfers never count toward budget spent (same semantics as ADR-010 summaries).

### 4. Progress & status (server-authoritative)

```text
remaining = budget − spent   (may be negative)
percentage = spent / budget × 100   (not capped at 100; null if budget = 0)
```

Status thresholds (document for UX consistency):

| Status      | Rule                                         |
| ----------- | -------------------------------------------- |
| ON_TRACK    | percentage `< 80` (or budget 0 & spent 0)    |
| WARNING     | percentage `≥ 80` and `≤ 100`                |
| OVER_BUDGET | percentage `> 100` or (budget 0 & spent > 0) |

### 5. Deletion — archive, keep history

- `DELETE` sets `status = ARCHIVED` (and `archivedAt`).
- Archived budgets remain readable for the period; creating again for the same month is blocked while a row exists (including archived) — use PATCH to reactivate/edit instead.
- Transactions/categories/accounts are never modified by budget lifecycle.

### 6. Privacy

- No budget amounts in Activity, Notifications, analytics, or unfiltered Sentry payloads.
- Phase 2B does **not** add scheduled budget notification jobs; UI alerts on the Budgets page are enough.

### 7. Currency

- Budget currency = `Family.defaultCurrency` at create time.
- No multi-currency conversion; assume transactions for the family use the same currency (Phase 2A default).

## Consequences

- Phase 2C intelligence can compare planned vs actual without a second ledger.
- Indexes on transactions from Phase 2A are reused for month/category aggregates.
