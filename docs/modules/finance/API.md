# Finance API

Base: `/v1/families/:familyId/finance`  
Guards: JWT + `FamilyMemberGuard` (cross-tenant → 404)

| Method | Path                           | Purpose                                                                  |
| ------ | ------------------------------ | ------------------------------------------------------------------------ |
| GET    | `/accounts`                    | List accounts + balances                                                 |
| POST   | `/accounts`                    | Create account                                                           |
| PATCH  | `/accounts/:accountId`         | Rename / deactivate / owner                                              |
| GET    | `/categories`                  | List (+ seed defaults)                                                   |
| POST   | `/categories`                  | Create custom category                                                   |
| PATCH  | `/categories/:categoryId`      | Rename / deactivate                                                      |
| GET    | `/transactions`                | List with filters (`from`, `to`, `type`, `accountId`, `categoryId`, `q`) |
| POST   | `/transactions`                | Create income / expense / transfer                                       |
| GET    | `/transactions/:transactionId` | Get one                                                                  |
| PATCH  | `/transactions/:transactionId` | Edit                                                                     |
| DELETE | `/transactions/:transactionId` | Soft delete                                                              |
| GET    | `/summary`                     | Monthly dashboard (`month=YYYY-MM`, embeds ACTIVE `budget`)              |
| GET    | `/budgets`                     | Budget for month + progress                                              |
| POST   | `/budgets`                     | Create monthly budget                                                    |
| GET    | `/budgets/:budgetId`           | Get one with progress                                                    |
| PATCH  | `/budgets/:budgetId`           | Update total / items / status                                            |
| DELETE | `/budgets/:budgetId`           | Archive                                                                  |
| GET    | `/analysis`                    | Deterministic intelligence for a month                                   |

Amounts are strings of integer minor units (`amountMinor`, `balanceMinor`, …).  
Budget details: [budgeting/API.md](./budgeting/API.md).  
Intelligence: [intelligence/API.md](./intelligence/API.md).
