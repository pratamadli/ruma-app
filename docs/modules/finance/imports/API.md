# Import API

Base: `/v1/families/:familyId`

## Email connections

| Method | Path                                     | Notes                                  |
| ------ | ---------------------------------------- | -------------------------------------- |
| GET    | `/integrations/email`                    | List connections (+ `gmailConfigured`) |
| POST   | `/integrations/email/synthetic`          | OWNER/ADMIN — demo inbox               |
| GET    | `/integrations/email/gmail/auth-url`     | OWNER/ADMIN                            |
| POST   | `/integrations/email/gmail`              | OWNER/ADMIN — `{ code }`               |
| DELETE | `/integrations/email/:connectionId`      | OWNER/ADMIN — disconnect               |
| POST   | `/integrations/email/:connectionId/sync` | `{ lookbackDays: 7\|30\|90 }`          |

## Candidates

| Method | Path                                    | Notes                      |
| ------ | --------------------------------------- | -------------------------- |
| GET    | `/finance/imports`                      | Optional `?status=`        |
| GET    | `/finance/imports/:candidateId`         |                            |
| PATCH  | `/finance/imports/:candidateId`         | Edit pending fields        |
| POST   | `/finance/imports/:candidateId/confirm` | Creates ledger transaction |
| POST   | `/finance/imports/:candidateId/ignore`  |                            |

Tokens and raw email bodies are never included in responses.
