# RUMA — AI Guidelines

AI is an enhancement layer, not the source of truth.

AI may:

- categorize
- summarize
- explain
- recommend
- predict
- identify patterns

AI must not:

- invent transactions
- silently modify financial records
- invent household facts
- bypass authorization
- replace deterministic business rules

For financial email parsing:

1. Extract candidate data.
2. Validate structure.
3. Preserve original source.
4. Mark confidence.
5. Require user confirmation when ambiguity matters.
6. Store deterministic structured data separately from AI reasoning.

Monthly AI reports should cite the underlying data and clearly distinguish facts from recommendations.

## Finance fact pipeline (Phase 2C+)

Future AI reports must consume **structured financial facts** from the deterministic intelligence layer (`GET …/finance/analysis`), not invent numbers:

```text
Manual + Email import (2D) → Ledger (2A) → Budgets (2B) → Analysis facts (2C) → AI explanation (later)
```

Phase 2D uses **deterministic** email parsers only. Future AI parsers must still emit untrusted candidates through the same validation + confirm path.

AI may narrate verified facts (totals, MoM %, top categories, budget status, recurring candidates). AI must not recalculate authoritative money figures.
