# Finance security

## Authorization

Every endpoint requires an active family membership. Resource lookups always include `familyId`. Cross-family IDs return **404**.

## Sensitivity

- Do not write amounts, descriptions, or account identifiers into `FamilyActivity` or `Notification`.
- Phase 2A emits **no** finance notifications.
- Sentry scrubbing includes finance-related keys (`amount`, `balance`, `account`, `transaction`, …).
- Never send financial payloads to analytics.

## Logging

Prefer logging resource IDs and error codes only — not amounts or free-text descriptions.
