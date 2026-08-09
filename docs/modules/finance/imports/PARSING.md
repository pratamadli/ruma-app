# Parsing

Deterministic only — no LLM in Phase 2D.

## Supported formats

### Synthetic Bank (demo / CI)

Key/value body:

```text
PROVIDER: SYNTHETIC_BANK
TYPE: EXPENSE|INCOME|TRANSFER
AMOUNT: 150000
CURRENCY: IDR
DATE: YYYY-MM-DD
MERCHANT: ...
DESCRIPTION: ...
ACCOUNT: BCA
REFERENCE: ...
```

### BCA-style notification

Recognizes `bca.co.id` / BCA subject/body patterns; extracts `Rp` amounts, dates, merchant lines.

### Mandiri-style notification

Recognizes `bankmandiri.co.id` / Mandiri patterns; debit/credit/transfer heuristics.

### GoPay notification

Recognizes GoPay / Gojek payment and top-up templates.

## Normalized fields

`parserProvider`, `transactionType`, `amountMinor` (BIGINT), `currency`, `transactionDate`, `description`, `merchant`, `reference`, `accountHint`, `categoryHint`, `confidence`, `parseError`.

## Confidence

| Level  | When                                       |
| ------ | ------------------------------------------ |
| HIGH   | Amount, date, type, currency IDR all clear |
| MEDIUM | Ambiguous transfer semantics               |
| LOW    | Missing fields / unsupported currency      |

Unsupported currency → `parseError`, not silent conversion.
Missing amount → FAILED candidate (not a ledger transaction).
