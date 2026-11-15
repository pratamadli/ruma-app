# Changelog

## Unreleased

- Add household-dashboard Connect to Telegram, user-and-household-bound email/code
  verification, active-household routing, and a native Hermes private-chat
  connection plugin. Reject cross-household tool calls and stale-context draft
  buttons; scheduled messages require the matching household connection.

- Extend existing finance with personal/household ownership, private audits,
  idempotent writes, stricter rupiah/date validation and scoped account access.
- Add transaction editing, scope/date/payer filtering, pagination, scoped
  dashboards, budget allocations and manual savings goals.
- Add secure Telegram linking, Hermes draft tools and explicit trusted
  confirmation; model output cannot authorize ledger writes.
- Add private validated receipt upload, configurable OCR/manual review,
  duplicate detection and authorized transaction receipt downloads.
- Add manual investment activity, exact quantity/price/fee accounting and
  separate valuation snapshots.
- Add timezone-aware reminders/monthly Telegram reports with durable recipient
  isolation and idempotent delivery claims; jobs disabled by default.
- Preserve household email imports and original data; fix first-day DATE range
  inclusion. Add five additive database migrations and deployment guidance.
