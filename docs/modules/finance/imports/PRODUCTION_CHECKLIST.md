# Finance import production checklist

| Item                                                              | Where                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                       | API env                                                |
| `GOOGLE_OAUTH_REDIRECT_URL` = `{WEB}/integrations/gmail/callback` | API env + Google Cloud console                         |
| `EMAIL_TOKEN_ENCRYPTION_KEY` (64 hex chars)                       | API env                                                |
| Sentry DSN (optional)                                             | API + web                                              |
| Migration `20260809010000_phase2d_email_import` applied           | Postgres                                               |
| Production build (`pnpm build`)                                   | CI/deploy                                              |
| Gmail connect + consent                                           | Finance → Imports                                      |
| Gmail disconnect                                                  | Finance → Imports                                      |
| Manual sync (7/30/90)                                             | Finance → Imports                                      |
| Duplicate sync (0 new)                                            | Finance → Imports                                      |
| Parser fixture tests                                              | `pnpm --filter @ruma/api test`                         |
| Family isolation                                                  | import integration tests                               |
| Token leakage check                                               | API responses never include tokens; Sentry scrub regex |

## Redirect URI

```text
http://localhost:3000/integrations/gmail/callback
https://<production-host>/integrations/gmail/callback
```
