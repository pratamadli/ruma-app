# Budget data model

## `Budget`

| Field              | Notes                                          |
| ------------------ | ---------------------------------------------- |
| `periodMonth`      | `YYYY-MM`, unique per family                   |
| `totalAmountMinor` | Optional household ceiling                     |
| `currency`         | Copied from `Family.defaultCurrency` at create |
| `status`           | `ACTIVE` \| `ARCHIVED`                         |

## `BudgetItem`

| Field         | Notes                                    |
| ------------- | ---------------------------------------- |
| `categoryId`  | Existing `TransactionCategory` (EXPENSE) |
| `amountMinor` | Category envelope                        |
| unique        | `(budgetId, categoryId)`                 |

Spent is **never** stored — always aggregated from `transactions`.
