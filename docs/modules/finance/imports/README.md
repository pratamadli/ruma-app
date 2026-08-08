# Finance imports (Phase 2D)

Automatic transaction capture from email — **suggest, then confirm**.

## Status

**COMPLETE** · product version `2.3.0` · [ADR-013](../../../adr/013-email-transaction-import-phase2d.md)

## Principle

```text
Email → Provider → Parser → ImportCandidate → User confirm → Transaction ledger
```

Never a parallel ledger. Confirmed candidates call the same finance creation path as manual entry (`source = IMPORT`).

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PARSING.md](./PARSING.md)
- [DEDUPLICATION.md](./DEDUPLICATION.md)
- [SECURITY.md](./SECURITY.md)
- [API.md](./API.md)

## In scope

- Provider abstraction (`SYNTHETIC`, `GMAIL`)
- Deterministic parsers (Synthetic Bank + BCA-style)
- Review queue: edit / confirm / ignore
- Manual bounded sync (7 / 30 / 90 days)
- Email + fingerprint deduplication

## Out of scope

- Auto-confirm, AI parsing, bank APIs, SMS/WhatsApp, scheduled workers, Outlook
