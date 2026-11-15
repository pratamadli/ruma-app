# Finance module

## Finance platform extension

The existing web routes now share an explicit Personal/Household selector.
Accounts, transaction history, dashboard totals and deterministic intelligence
respect the selected scope. Transaction entry supports edits, void confirmation,
date/payer filters and pagination. Account scope is immutable; use a new account
instead of making private history public. Categories remain a shared taxonomy.
See [the implementation plan](../../finance-implementation-plan.md) and
[ADR-015](../../adr/015-personal-household-finance.md).

Household finance source of truth, budgeting, intelligence, and email import.

## Status

- **Phase 2A** — Manual Finance Foundation (`2.0.0`)
- **Phase 2B** — Budgeting (`2.1.0`)
- **Phase 2C** — Financial Intelligence (`2.2.0`)
- **Phase 2D** — Automatic Transaction Capture (`2.3.0`)
- **Phase 2E** — Finance Import Hardening (`2.4.0`)

## Scope

| In scope                                               | Out of scope (later)                        |
| ------------------------------------------------------ | ------------------------------------------- |
| Personal/household accounts and ledger                 | Bank APIs / Open Banking                    |
| Shared category taxonomy                               | Multi-currency conversion                   |
| Balances, monthly summaries and deterministic insights | Autonomous payments or investment execution |
| Scoped budgets, allocations and manual goals           | Tax / realized-gain accounting              |
| Email import and Telegram/Hermes draft review          | Scheduled email sync workers                |
| Private receipt upload and configurable OCR review     | Telegram photo transport                    |
| Manual investments and valuation snapshots             | Broker sync / live market prices            |
| Scoped reminders and scheduled Telegram reports        | AI-generated financial advice               |

Live provider configuration is required; see [AUTOMATION.md](./AUTOMATION.md) and the
[implementation report](../../finance-implementation-report.md).

## Pattern

```text
Authenticated user → Family membership → Finance resource
```

No finance/budget/insight/import amounts in household Activity or Notifications (ADR-010/011/012/013).

## Docs

- [DATA_MODEL.md](./DATA_MODEL.md)
- [API.md](./API.md)
- [SECURITY.md](./SECURITY.md)
- [AUTOMATION.md](./AUTOMATION.md)
- [budgeting/](./budgeting/README.md)
- [intelligence/](./intelligence/README.md)
- [imports/](./imports/README.md)
- [ADR-010](../../adr/010-household-finance-phase2a.md)
- [ADR-011](../../adr/011-household-budgeting-phase2b.md)
- [ADR-012](../../adr/012-financial-intelligence-phase2c.md)
- [ADR-013](../../adr/013-email-transaction-import-phase2d.md)
