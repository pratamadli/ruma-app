# Import security & privacy

## Permissions (Gmail)

| Item             | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Scope            | `gmail.readonly`                                     |
| Why              | Read transaction notification emails                 |
| What RUMA reads  | Filtered message list + plain-text bodies of matches |
| What RUMA stores | Normalized candidate fields only (no raw body)       |
| Disconnect       | Clears encrypted tokens; status `DISCONNECTED`       |

## Tokens

- Encrypted at rest with `EMAIL_TOKEN_ENCRYPTION_KEY` (AES-256-GCM)
- Never returned in API responses
- Never logged; scrubbed from Sentry (`email|token|message|body|merchant|reference|candidate|import|gmail|oauth`)

## Family access

| Action                             | Roles                    |
| ---------------------------------- | ------------------------ |
| Connect / disconnect / Gmail OAuth | `OWNER`, `ADMIN`         |
| Sync / review / confirm / ignore   | Any active family member |

## Consent copy (product)

RUMA will read transaction-related emails to help record household finances. Not for advertising, analytics, or unrelated features. Disconnect anytime.

## Privacy

Same as ADR-010–012: no import amounts in Activity or Notifications.
