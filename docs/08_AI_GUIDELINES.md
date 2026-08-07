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
