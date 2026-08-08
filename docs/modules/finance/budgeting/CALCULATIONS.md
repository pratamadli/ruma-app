# Budget calculations

## Spent

```text
category spent = Σ EXPENSE amountMinor for category in month (deletedAt null)
household spent = Σ EXPENSE amountMinor in month (deletedAt null)
```

Excluded: `INCOME`, `TRANSFER`.

## Remaining & percentage

```text
remaining = budget − spent          (may be negative)
percentage = spent / budget × 100   (null if budget = 0; not capped at 100)
```

## Status (ADR-011)

| Status      | Rule                                         |
| ----------- | -------------------------------------------- |
| ON_TRACK    | percentage `< 80` (or budget 0 & spent 0)    |
| WARNING     | `80 ≤ percentage ≤ 100`                      |
| OVER_BUDGET | percentage `> 100` or (budget 0 & spent > 0) |
