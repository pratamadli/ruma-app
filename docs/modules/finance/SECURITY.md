# Finance security

## Authorization

Every endpoint requires an active family membership. Resource lookups always include `familyId`. Cross-family IDs return **404**.

Accounts and transactions additionally enforce PERSONAL owner or HOUSEHOLD scope.
Changing a resource ID cannot expose another member's personal data. Scope is
immutable; a transaction's accounts must match its scope and currency. Household
email imports and intelligence explicitly exclude personal ledger rows. Shared
categories contain taxonomy only. See [ADR-015](../../adr/015-personal-household-finance.md).

## Sensitivity

- Do not write amounts, descriptions, or account identifiers into `FamilyActivity` or `Notification`.
- Phase 2A emits **no** finance notifications.
- Sentry scrubbing includes finance-related keys (`amount`, `balance`, `account`, `transaction`, …).
- Never send financial payloads to analytics.

## Logging

Prefer logging resource IDs and error codes only — not amounts or free-text descriptions.

## Assisted writes and scheduled delivery

Hermes can prepare drafts, never approve them. Ledger writes require a signed-in
user or a secret-authenticated Telegram callback bound to the linked sender and
specific draft. Link codes expire, are hashed, and are consumed once. Model and
OCR output is untrusted; corrections invalidate prior confirmation buttons.

Connection codes are bound to both the issuing user and chosen household, with
email and current membership checked at consumption. One shared bot can serve
many households without treating a household name, username, or email alone as
proof of identity. A household switch invalidates old-context Telegram callbacks.
The native Hermes connection command takes identity only from its private-chat
transport source; never expose service credentials to a general-purpose agent
with unrestricted terminal/file access in a multi-tenant bot.

Pending receipts are private to uploaders, even in household scope. Only an
attached, non-voided household transaction grants other members download access.
Upload validation decodes/re-encodes images and enforces MIME, byte and pixel
limits. Private persistent storage and provider credentials remain API-only.

Goals, budgets, holdings and schedules use the same explicit scope boundary.
Jobs recheck active memberships, current schedule configuration and Telegram
links before delivery. Personal reports never use household recipients.
Financial Telegram reports are opt-in exceptions to the prohibition on generic
household activity/notification payloads. Disable jobs by default and verify
recipients before enabling them. Uncertain sends are not retried automatically.
