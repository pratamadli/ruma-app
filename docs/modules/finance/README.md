# Finance module (Phase 2A–2B)

Household finance source of truth: accounts, categories, manual transactions, transfers, monthly summary, and budgeting.

## Status

- **Phase 2A** — Manual Finance Foundation (`2.0.0`)
- **Phase 2B** — Budgeting (`2.1.0`)

## Scope

| In scope                                 | Out of scope (later)                |
| ---------------------------------------- | ----------------------------------- |
| Accounts (bank / cash / e-wallet / card) | Intelligence trends (2C)            |
| Categories (income / expense)            | Email import / AI categorize (2D)   |
| Income, expense, transfer                | Investments, net worth, bank sync   |
| Balances + monthly summary               | Scheduled budget push notifications |
| Monthly household + category budgets     |                                     |

## Pattern

```text
Authenticated user → Family membership → Finance resource
```

No finance/budget amounts in household Activity or Notifications (ADR-010/011).

## Docs

- [DATA_MODEL.md](./DATA_MODEL.md)
- [API.md](./API.md)
- [SECURITY.md](./SECURITY.md)
- [budgeting/](./budgeting/README.md)
- [ADR-010](../../adr/010-household-finance-phase2a.md)
- [ADR-011](../../adr/011-household-budgeting-phase2b.md)
