# ADR-014: Finance import hardening (Phase 2E)

## Status

Accepted

## Context

Phase 2D shipped suggest→confirm email import (`2.3.0`). Production gaps remained: weak OAuth `state`, incomplete Gmail web UX, no token refresh, single-page sync, limited parsers, and review UX friction.

## Decisions

### 1. HMAC-signed OAuth state (CSRF)

`state = base64url(payload).hmac` with TTL (~10 minutes). Payload includes `familyId`, `actorId`, `nonce`, `exp`.  
Completion requires `code` **and** `state`; family/actor must match the authenticated request.

### 2. Token refresh before sync

Use stored refresh token when access token is missing or near expiry. Auth failures mark connection `ERROR` and ask the user to reconnect.

### 3. Disconnect revokes best-effort

Local credentials are always cleared. Google token revoke is attempted when possible; failure does not block disconnect.

### 4. Sync reliability without workers

- Paginated Gmail list (hard caps: pages/messages)
- Bounded retries for 429/5xx + timeouts
- Partial failure: keep successful candidates; report `messageFetchFailures` / `truncated`
- Unique `(connectionId, providerMessageId)` remains authoritative; P2002 treated as already processed

### 5. Parsers

Add high-confidence **Mandiri** and **GoPay** fixture-driven parsers alongside Synthetic + BCA. No AI parsing.

### 6. Bulk actions

Bulk **ignore** only (safe). Bulk confirm deferred (transfers / incomplete fields are high risk).

### 7. Permissions unchanged

OWNER/ADMIN connect & disconnect; any member sync/review (ADR-013).

## Consequences

- Gmail is usable from the web when Google env vars + encryption key are set.
- Sync status surfaces `COMPLETED` vs `PARTIAL`.
- Phase 3A still waits on production Gmail soak + parser confidence — not blocked by architecture.
