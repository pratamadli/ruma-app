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
| GET    | `/summary`                     | Monthly dashboard (`month=YYYY-MM`)                                      |

Amounts are strings of integer minor units (`amountMinor`, `balanceMinor`, …).
