# Finance module (Phase 2A–2C)

Household finance source of truth plus deterministic intelligence.

## Status

- **Phase 2A** — Manual Finance Foundation (`2.0.0`)
- **Phase 2B** — Budgeting (`2.1.0`)
- **Phase 2C** — Financial Intelligence (`2.2.0`)

## Scope

| In scope                                 | Out of scope (later)              |
| ---------------------------------------- | --------------------------------- |
| Accounts (bank / cash / e-wallet / card) | Email import / AI categorize (2D) |
| Categories (income / expense)            | Investments, net worth, bank sync |
| Income, expense, transfer                | Scheduled push notifications      |
| Balances + monthly summary               | LLM monthly reports               |
| Monthly household + category budgets     |                                   |
| Deterministic trends / insights          |                                   |

## Pattern

```text
Authenticated user → Family membership → Finance resource
```

No finance/budget/insight amounts in household Activity or Notifications (ADR-010/011/012).

## Docs

- [DATA_MODEL.md](./DATA_MODEL.md)
- [API.md](./API.md)
- [SECURITY.md](./SECURITY.md)
- [budgeting/](./budgeting/README.md)
- [intelligence/](./intelligence/README.md)
- [ADR-010](../../adr/010-household-finance-phase2a.md)
- [ADR-011](../../adr/011-household-budgeting-phase2b.md)
- [ADR-012](../../adr/012-financial-intelligence-phase2c.md)
