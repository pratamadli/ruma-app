# Finance module (Phase 2A)

Household finance source of truth: accounts, categories, manual transactions, transfers, and monthly summary.

## Status

**Phase 2A — Manual Finance Foundation** shipped in product version `2.0.0`.

## Scope

| In scope                                 | Out of scope (later)              |
| ---------------------------------------- | --------------------------------- |
| Accounts (bank / cash / e-wallet / card) | Budgets (2B)                      |
| Categories (income / expense)            | Intelligence trends (2C)          |
| Income, expense, transfer                | Email import / AI categorize (2D) |
| Balances + monthly summary               | Investments, net worth, bank sync |

## Pattern

```text
Authenticated user → Family membership → Finance resource
```

No finance amounts in household Activity or Notifications (ADR-010).

## Docs

- [DATA_MODEL.md](./DATA_MODEL.md)
- [API.md](./API.md)
- [SECURITY.md](./SECURITY.md)
- [ADR-010](../../adr/010-household-finance-phase2a.md)
