# Finance data model

## Entities

### `FinancialAccount`

Household places money is held. Optional `ownerUserId` is UX-only; tenant is always `familyId`.

- `initialBalanceMinor` — opening balance in minor units
- `balance` — **not stored**; computed server-side

### `TransactionCategory`

Family-scoped. Seeded defaults on first finance access. Prefer `isActive = false` over delete.

### `Transaction`

Normalized ledger row for manual entry and confirmed imports (`source`, `sourceReference`, `confidence`).

| Type     | `accountId`    | `transferAccountId` | `categoryId`     | Summary impact                      |
| -------- | -------------- | ------------------- | ---------------- | ----------------------------------- |
| INCOME   | credit account | null                | optional INCOME  | + income                            |
| EXPENSE  | debit account  | null                | optional EXPENSE | + expense                           |
| TRANSFER | source         | destination         | null             | tracked separately; **not** expense |

Amounts are always **positive** minor units.

## Money

PostgreSQL `BIGINT` / Prisma `BigInt`. API JSON strings. For IDR, 1 minor unit = Rp 1.

## Dates

`transactionDate` is `@db.Date` (`YYYY-MM-DD`), timezone-stable for reporting.

## Soft delete

Transactions set `deletedAt`. Soft-deleted rows are excluded from balances and summaries.

## Import entities (Phase 2D)

### `EmailConnection`

Family mailbox link (`SYNTHETIC` | `GMAIL`). OAuth tokens encrypted; never exposed via API.

### `ImportCandidate`

Parsed email awaiting review. Unique `(connectionId, providerMessageId)`. On confirm → `Transaction` with `source = IMPORT` and `sourceReference = candidate:<id>`.

See [imports/](./imports/README.md).
