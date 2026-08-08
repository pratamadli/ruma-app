# ADR-013: Email transaction import (Phase 2D)

## Status

Accepted

## Context

Phase 2A–2C provide a trustworthy ledger, budgets, and deterministic intelligence. Manual entry remains friction. Phase 2D adds email ingestion that must converge into the **same** `Transaction` model — never a parallel ledger.

## Decisions

### 1. Suggest → confirm (not auto-post)

All parsed emails become `ImportCandidate` with status `PENDING_REVIEW`.  
Even `HIGH` confidence requires user confirm/ignore. Automation can tighten later.

### 2. Models: `EmailConnection` + `ImportCandidate`

- No `ImportedTransaction` table.
- Confirmed candidates call the existing finance transaction creation path with `source = IMPORT` and `sourceReference = candidate:<id>`.

### 3. Provider abstraction

```text
EmailProvider → listMessages / getMessage
  ├── SYNTHETIC (fixtures; local + CI)
  └── GMAIL (OAuth; optional env)
```

Domain parsers receive normalized `RawEmailMessage`, not Gmail payloads.

### 4. Parsers (narrow)

- `SyntheticBankParser` — fixture format for tests/demo
- `BcaNotificationParser` — common BCA-style notification shape (synthetic fixtures)

Unknown senders → not candidates (or FAILED with parse error). Prefer 2 reliable formats over many weak ones.

### 5. Deduplication

1. **Email-level:** unique `(connectionId, providerMessageId)` — second sync is a no-op.
2. **Transaction-level fingerprint:** `familyId + type + amountMinor + transactionDate + normalized(description|merchant)` — if an existing non-deleted transaction matches, set `possibleDuplicateTransactionId` and still require review (never silent skip of a different message).

### 6. OAuth & tokens (Gmail)

- Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_TOKEN_ENCRYPTION_KEY` (32-byte hex).
- Scopes: Gmail readonly (`gmail.readonly`) — documented as minimum for reading transaction mail.
- Tokens encrypted at rest (AES-256-GCM); never returned in API/logs/Sentry.
- Connect/disconnect: `OWNER` / `ADMIN` only. Sync + review: any active family member.

### 7. Sync

- Manual sync only; bounded lookback (`7` | `30` | `90` days).
- No worker/Kafka/Redis in Phase 2D.

### 8. Retention

- After `CONFIRMED`: keep candidate row for audit (status + link to transaction); do **not** store raw email body.
- `IGNORED` / `FAILED`: retain metadata; no body storage by default.
- SYNTHETIC provider never persists mailbox content beyond candidate fields.

### 9. Privacy

Same as ADR-010–012: no Activity/Notifications for import amounts; scrub `email|token|message|body|merchant|reference|candidate|import`.

## Consequences

- Intelligence/budgets update automatically once confirmed.
- Gmail can be enabled per environment without blocking CI (SYNTHETIC path).
- Future Outlook / AI parsers plug in behind the same candidate → confirm → ledger path.
