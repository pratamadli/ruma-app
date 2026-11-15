# Finance data model

## Entities

### `FinancialAccount`

Places money is held within a family, with immutable PERSONAL or HOUSEHOLD scope.
Personal `ownerUserId` is an authorization boundary, derived from authentication.
Household account owners remain display labels. Existing records are backfilled
HOUSEHOLD, never inferred private from the old label.

- `initialBalanceMinor` — opening balance in minor units
- `balance` — **not stored**; computed server-side

### `TransactionCategory`

Family-scoped. Seeded defaults on first finance access. Prefer `isActive = false` over delete.

### `Transaction`

Normalized ledger row for manual entry and confirmed imports (`source`, `sourceReference`, `confidence`).

| Type               | `accountId`                   | `transferAccountId`            | `categoryId`        | Summary impact                                |
| ------------------ | ----------------------------- | ------------------------------ | ------------------- | --------------------------------------------- |
| INCOME             | credit account                | null                           | optional INCOME     | + income                                      |
| EXPENSE            | debit account                 | null                           | optional EXPENSE    | + expense                                     |
| TRANSFER           | source                        | destination                    | null                | tracked separately; **not** expense           |
| INVESTMENT_BUY     | cash debit (principal + fees) | investment credit (principal)  | optional INVESTMENT | separate contributions and fees               |
| INVESTMENT_SELL    | investment debit (principal)  | cash credit (principal - fees) | optional INVESTMENT | separate withdrawals and fees                 |
| DIVIDEND           | cash credit                   | null                           | optional INVESTMENT | separate dividends; included in net cash flow |
| BALANCE_ADJUSTMENT | increase/decrease account     | null                           | null                | no income/expense impact                      |

Amounts are always **positive** minor units.

## Money

PostgreSQL `BIGINT` / Prisma `BigInt`. API JSON strings. For IDR, 1 minor unit = Rp 1.

## Dates

`transactionDate` is `@db.Date` (`YYYY-MM-DD`), timezone-stable for reporting.
DATE range bounds use UTC midnight, including the first day of each month.

## Planning, review and automation

- Budgets have scope/owner and income, savings and investment allocations.
  One household budget and one personal budget per owner/month may coexist.
- `FinanceGoal` stores manual progress, without mutating ledger history.
- `FinanceAudit` records actor, action and resource ID privately; never financial
  payloads in household activity.
- `TelegramLink` stores numeric Telegram identity, active `familyId` and expiring
  hashed codes bound to `userId`/`codeFamilyId`. Connecting requires the issuing
  user's email and active membership. One Telegram identity cannot impersonate
  another member by sharing a household code. Family deletion clears bindings.
- `FinanceDraft` is creator-private, expires after 15 minutes, and uses atomic
  confirmation. Corrections cancel the old draft and create a new ID.
- `FinanceReceipt` holds private storage metadata, extraction and an optional
  confirmed transaction reference. Images never live in public web roots.
- `InvestmentPosition` holds manual units (decimal strings up to eight places).
  `InvestmentValuation` snapshots are unique by position/date; latest values are
  separate from ledger-derived account balances. Trades never change positions
  implicitly or double-count a valuation as income.
- `FinanceSchedule` holds immutable scope/kind, timezone and recipient IDs.
  Personal schedules target only their owner. Empty household recipients means
  all active members. Monthly-report uniqueness uses a partial expression index.
- `FinanceDelivery` is unique per schedule/recipient/period. Claims transition
  PENDING to SENDING atomically; final states are SENT, FAILED or UNCERTAIN.

Six additive migrations extend existing finance tables. Partial uniqueness and
ownership checks are migration-level constraints; retain them when evolving the
Prisma schema. See [ADR-015](../../adr/015-personal-household-finance.md).

## Soft delete

Transactions set `deletedAt`. Soft-deleted rows are excluded from balances and summaries.

## Import entities (Phase 2D)

### `EmailConnection`

Family mailbox link (`SYNTHETIC` | `GMAIL`). OAuth tokens encrypted; never exposed via API.

### `ImportCandidate`

Parsed email awaiting review. Unique `(connectionId, providerMessageId)`. On confirm → `Transaction` with `source = IMPORT` and `sourceReference = candidate:<id>`.

See [imports/](./imports/README.md).
