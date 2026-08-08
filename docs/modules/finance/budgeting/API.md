# Budget API

Base: `/v1/families/:familyId/finance`

| Method | Path                     | Purpose                                      |
| ------ | ------------------------ | -------------------------------------------- |
| GET    | `/budgets?month=YYYY-MM` | Month view + progress (`budget` may be null) |
| POST   | `/budgets`               | Create month budget                          |
| GET    | `/budgets/:budgetId`     | Budget with progress                         |
| PATCH  | `/budgets/:budgetId`     | Update total/items/status                    |
| DELETE | `/budgets/:budgetId`     | Archive (`status=ARCHIVED`)                  |

`GET /summary` embeds `budget` when an **ACTIVE** budget exists for the month.

All progress fields (`spentMinor`, `remainingMinor`, `percentage`, `status`) are server-computed.
