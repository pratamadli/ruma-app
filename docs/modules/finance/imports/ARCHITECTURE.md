# Import architecture

## Pipeline

```text
Mailbox (provider)
  → sender/subject filter (provider query + parser match)
  → RawEmailMessage
  → TransactionEmailParser (first match)
  → ImportCandidate (PENDING_REVIEW | FAILED)
  → user edit / confirm / ignore
  → FinanceService.createLedgerTransaction (IMPORT)
  → Budget + Intelligence (unchanged)
```

## Provider abstraction

`EmailProvider` exposes `listMessages({ lookbackDays, accessToken? }) → RawEmailMessage[]`.

| Kind        | Purpose                      |
| ----------- | ---------------------------- |
| `SYNTHETIC` | Fixture inbox for demo + CI  |
| `GMAIL`     | Optional OAuth readonly sync |

Domain services never depend on Gmail payload shapes.

## Candidate lifecycle

```text
PENDING_REVIEW → CONFIRMED → Transaction
              → IGNORED
FAILED (parse/validation) → IGNORED (dismiss)
```

Even `HIGH` confidence stays in review for Phase 2D.

## Account / category hints

- Account: unique name contains `accountHint`, else needs review
- Category: exact name match for income/expense kinds
- Transfers: never auto-pick destination — user must confirm both accounts

## Retention

- No raw email bodies stored
- Candidate rows kept for audit after confirm (status + `confirmedTransactionId`)
- OAuth tokens cleared on disconnect
