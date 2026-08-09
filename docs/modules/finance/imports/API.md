# Import API

Base: `/v1/families/:familyId`

## Email connections

| Method | Path                                     | Notes                                         |
| ------ | ---------------------------------------- | --------------------------------------------- |
| GET    | `/integrations/email`                    | List connections (+ `gmailConfigured`)        |
| POST   | `/integrations/email/synthetic`          | OWNER/ADMIN — demo inbox                      |
| GET    | `/integrations/email/gmail/auth-url`     | OWNER/ADMIN — signed `state`                  |
| POST   | `/integrations/email/gmail`              | OWNER/ADMIN — `{ code, state }`               |
| DELETE | `/integrations/email/:connectionId`      | OWNER/ADMIN — disconnect + best-effort revoke |
| POST   | `/integrations/email/:connectionId/sync` | `{ lookbackDays }` → `COMPLETED` \| `PARTIAL` |

## Candidates

| Method | Path                                    | Notes                            |
| ------ | --------------------------------------- | -------------------------------- |
| GET    | `/finance/imports`                      | Optional `?status=`              |
| POST   | `/finance/imports/bulk-ignore`          | `{ candidateIds }` — ignore only |
| GET    | `/finance/imports/:candidateId`         |                                  |
| PATCH  | `/finance/imports/:candidateId`         | Edit pending fields              |
| POST   | `/finance/imports/:candidateId/confirm` | Creates ledger transaction       |
| POST   | `/finance/imports/:candidateId/ignore`  |                                  |

Tokens and raw email bodies are never included in responses.

Web OAuth callback: `/integrations/gmail/callback`
