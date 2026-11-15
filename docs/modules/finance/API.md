# Finance API

Base: `/v1/families/:familyId/finance`  
Guards: JWT + `FamilyMemberGuard` (cross-tenant → 404)

| Method | Path                            | Purpose                                                                  |
| ------ | ------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/accounts`                     | List accounts + balances                                                 |
| POST   | `/accounts`                     | Create account                                                           |
| PATCH  | `/accounts/:accountId`          | Rename / deactivate / owner                                              |
| GET    | `/categories`                   | List (+ seed defaults)                                                   |
| POST   | `/categories`                   | Create custom category                                                   |
| PATCH  | `/categories/:categoryId`       | Rename / deactivate                                                      |
| GET    | `/transactions`                 | List with filters (`from`, `to`, `type`, `accountId`, `categoryId`, `q`) |
| POST   | `/transactions`                 | Create income / expense / transfer                                       |
| GET    | `/transactions/:transactionId`  | Get one                                                                  |
| PATCH  | `/transactions/:transactionId`  | Edit                                                                     |
| DELETE | `/transactions/:transactionId`  | Soft delete                                                              |
| GET    | `/summary`                      | Monthly dashboard (`month=YYYY-MM`, embeds ACTIVE `budget`)              |
| GET    | `/budgets`                      | Budget for month + progress                                              |
| POST   | `/budgets`                      | Create monthly budget                                                    |
| GET    | `/budgets/:budgetId`            | Get one with progress                                                    |
| PATCH  | `/budgets/:budgetId`            | Update total / items / status                                            |
| DELETE | `/budgets/:budgetId`            | Archive                                                                  |
| GET    | `/analysis`                     | Deterministic intelligence for a month                                   |
| GET    | `/imports`                      | Import candidates + history counts                                       |
| GET    | `/imports/:candidateId`         | One candidate                                                            |
| PATCH  | `/imports/:candidateId`         | Edit pending candidate                                                   |
| POST   | `/imports/:candidateId/confirm` | Confirm → ledger transaction                                             |
| POST   | `/imports/:candidateId/ignore`  | Ignore                                                                   |

Email connection endpoints live under `/v1/families/:familyId/integrations/email` — see [imports/API.md](./imports/API.md).

Amounts are strings of integer minor units (`amountMinor`, `balanceMinor`, …).  
Accounts, transactions and summary accept `scope=PERSONAL|HOUSEHOLD` (default:
HOUSEHOLD for backward compatibility). Create-account and create-transaction
bodies also accept scope; personal ownership is derived from authentication.
Transactions accept `payerUserId`, `idempotencyKey` (8-120 characters), and
`adjustmentDirection=INCREASE|DECREASE` for balance adjustments. Reusing a key with
a different payload returns 409. List supports `payerUserId`, `offset`, `limit`
and returns `nextOffset`.

Investment buys/sells require cash-to-investment/investment-to-cash accounts.
Their totals and dividends are separate from income/consumption expenses.
`netCashFlowMinor` includes dividends but excludes transfers and buy/sell
movements. New writes support IDR only; amounts remain integer strings.

Budget details: [budgeting/API.md](./budgeting/API.md).  
Budgets accept scope and `plannedIncomeMinor`, `savingsAllocationMinor`,
`investmentAllocationMinor`. `unallocatedMinor` subtracts spending (the ceiling,
or item sum when no ceiling) and allocations from planned income. Personal and
household budgets can coexist in the same month.

Goals: `GET/POST /goals`, `PATCH /goals/:id`. Fields: scope, name,
`targetAmountMinor`, `currentAmountMinor`, optional `targetDate`, and update
`status` (ACTIVE/COMPLETED/ARCHIVED). Progress is a manual snapshot, not a ledger
contribution. Archive rather than delete.
Intelligence: [intelligence/API.md](./intelligence/API.md).  
Imports: [imports/API.md](./imports/API.md).

## Assisted capture, holdings and schedules

| Method      | Path                          | Purpose                                           |
| ----------- | ----------------------------- | ------------------------------------------------- |
| GET/POST    | `/drafts`                     | List own pending drafts / prepare draft           |
| PATCH       | `/drafts/:id`                 | Replace draft; invalidate old confirmation        |
| POST        | `/drafts/:id/confirm`         | Authenticated explicit confirmation               |
| DELETE      | `/drafts/:id`                 | Cancel without ledger write                       |
| GET         | `/telegram`                   | Link status                                       |
| POST/DELETE | `/telegram/link`              | Issue code / revoke link                          |
| GET/POST    | `/receipts`                   | Own review records / multipart PNG or JPEG upload |
| GET         | `/receipts/:id/file`          | Authorized private download                       |
| POST        | `/receipts/:id/draft`         | Reviewed receipt details to draft                 |
| GET/POST    | `/investments`                | Scoped holdings / create manual position          |
| PATCH       | `/investments/:id`            | Update manual units/name or archive/restore       |
| POST        | `/investments/:id/valuations` | Upsert value by date                              |
| GET/POST    | `/schedules`                  | Scoped schedules/delivery status / create         |
| PATCH       | `/schedules/:id`              | Edit recipients/time/title or enable/disable      |

Transaction detail additionally returns `receiptIds`; downloading each receipt
rechecks membership and receipt authorization. Investment trades accept optional
`instrumentName`, paired `unitsDecimal`/`unitPriceMinor`, and `feesMinor`.
Principal equals quantity times unit price rounded to the nearest rupiah using
bigint math. Sell fees cannot exceed proceeds. Investment fees are separate from
consumption and ordinary net cash flow.

Holdings: `scope`, investment `accountId`, `instrumentName`, `assetType`,
`unitsDecimal`. Valuations: `valuationDate`, `valueMinor`. List includes latest
valuation/date and active `totalValuationMinor`; unvalued positions are excluded.

Schedules: `scope`, `kind=REMINDER|MONTHLY_REPORT`, `title`, optional description,
IANA `timezone`, `recipientIds`. Reminders require an offset-aware `dueAt`.
Reports use `deliveryDay` (1-28), `deliveryHour` (0-23), `deliveryMinute` (0-59).
Only one monthly report exists per scope/owner, even when disabled. Update the
existing report rather than creating another.

Integration routes use dedicated service/webhook authentication rather than
browser JWT. Contracts and deployment instructions: [AUTOMATION.md](./AUTOMATION.md).

## Household Telegram connection

`GET /telegram` returns `{linked, connectedElsewhere, requiresReconnect}` for the signed-in user and
the household in the route. `POST /telegram/link` returns
`{code,email,expiresAt,household:{id,name},botUrl}`. The code is bound to that user
and household, not shareable with other members. A new code invalidates the old
one; verifying it switches the active household. `DELETE /telegram/link` revokes
only the connection/pending code belonging to this household, never a connection
to a different active household. An orphaned/legacy connection or one whose
membership was revoked can be cleared from any currently authorized dashboard.

Trusted Hermes Gateway commands use these routes outside the family prefix:

| Method | Path                                          | Purpose                                          |
| ------ | --------------------------------------------- | ------------------------------------------------ |
| POST   | `/v1/integrations/hermes/telegram/connect`    | Verify `{email,code}` and activate its household |
| GET    | `/v1/integrations/hermes/telegram/connection` | Current verified household                       |
| DELETE | `/v1/integrations/hermes/telegram/connection` | Disconnect the current household                 |

All require `Authorization: Bearer <HERMES_SERVICE_TOKEN>` and a numeric
`x-telegram-user-id` supplied by trusted private-chat transport context. The
model must not choose that header. Codes are case-insensitive and single-use,
with a ten-minute expiry. Invalid email/code/membership returns generic
`LINK_INVALID`; identity conflicts return `TELEGRAM_ALREADY_LINKED`. No membership
is created by linking. Hermes tools reject family IDs outside the active
connection, regardless of other memberships.
