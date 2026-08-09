# Recurring detection

Heuristic only — **never** auto-creates transactions.

Group: `(categoryId, normalized description)`

Require:

1. ≥3 occurrences
2. Amounts within ±20% of median
3. Monthly-ish intervals (25–35 days) **or** same day-of-month across ≥3 months

Language: “appears to be”, “recurring pattern detected”.
