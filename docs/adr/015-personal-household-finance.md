# ADR-015: Personal finance and assisted capture inside Family

## Status

Accepted for the Finance platform implementation.

## Decisions

Extend existing finance entities rather than adding a second ledger or household.
Existing rows remain HOUSEHOLD. PERSONAL rows require an authenticated owner,
and every query combines family membership with explicit scope/ownership.
Account scope cannot change after creation. Shared categories are taxonomy only.
This supersedes ADR-010's statement that all new finance records are shared.

Keep bigint IDR amounts and calendar dates. Transfers and investment movements
are not ordinary income/expense. Dividends are reported separately. Adjustments
carry an explicit direction. Persist mutation audit metadata privately.

Hermes uses an authenticated API, never database credentials. Draft creation does
not post a transaction. Confirmation must be bound to the linked user, draft and
expiry, and committed atomically with the ledger write. A model-generated
confirmation string is insufficient.

Telegram connection is explicit per user and active household. A dashboard code
is single-use and bound to both IDs; the submitted email must match the issuing
user and membership must still be active. A shared bot must never interpret a
household-wide code plus an arbitrary member email as authorization. Switching
households requires another verified code and does not expose other memberships
to the model. The existing local Hermes Gateway can own Telegram transport via
a trusted connection-command plugin; do not run a competing webhook/poller.

Receipt extraction is an adapter and is always untrusted input requiring review.
Private persistent filesystem storage is the initial adapter because this
repository has no object storage. Background delivery uses PostgreSQL records,
not a distributed queue. Uncertain remote delivery is visible, not silently retried.

## Consequences

Migrations preserve household history. Finance remains within the existing brand,
auth, design system and modular monolith. Deployment requires explicit integration
configuration; no new external provider is enabled implicitly.
