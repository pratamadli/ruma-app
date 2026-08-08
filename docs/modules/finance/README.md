# Finance module (Phase 2A–2D)

Household finance source of truth, budgeting, intelligence, and email import.

## Status

- **Phase 2A** — Manual Finance Foundation (`2.0.0`)
- **Phase 2B** — Budgeting (`2.1.0`)
- **Phase 2C** — Financial Intelligence (`2.2.0`)
- **Phase 2D** — Automatic Transaction Capture (`2.3.0`)

## Scope

| In scope                                 | Out of scope (later)         |
| ---------------------------------------- | ---------------------------- |
| Accounts (bank / cash / e-wallet / card) | AI categorize / AI reports   |
| Categories (income / expense)            | Investments, net worth       |
| Income, expense, transfer                | Bank APIs / Open Banking     |
| Balances + monthly summary               | Scheduled email sync workers |
| Monthly household + category budgets     | Auto-confirm imports         |
| Deterministic trends / insights          |                              |
| Email import → review → ledger           |                              |

## Pattern

```text
Authenticated user → Family membership → Finance resource
```

No finance/budget/insight/import amounts in household Activity or Notifications (ADR-010/011/012/013).

## Docs

- [DATA_MODEL.md](./DATA_MODEL.md)
- [API.md](./API.md)
- [SECURITY.md](./SECURITY.md)
- [budgeting/](./budgeting/README.md)
- [intelligence/](./intelligence/README.md)
- [imports/](./imports/README.md)
- [ADR-010](../../adr/010-household-finance-phase2a.md)
- [ADR-011](../../adr/011-household-budgeting-phase2b.md)
- [ADR-012](../../adr/012-financial-intelligence-phase2c.md)
- [ADR-013](../../adr/013-email-transaction-import-phase2d.md)
