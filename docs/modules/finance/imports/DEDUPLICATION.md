# Deduplication

## Level 1 — Email message

Unique constraint: `(connectionId, providerMessageId)`.

Second sync of the same message is a no-op (`alreadyProcessed`).

## Level 2 — Transaction fingerprint

Fingerprint hash over:

```text
type | amountMinor | transactionDate | normalized(description|merchant)
```

If an existing non-deleted transaction matches the fingerprint, set `possibleDuplicateTransactionId` and still require review. Never silently skip a different provider message.

Do **not** dedupe on amount+date alone.
