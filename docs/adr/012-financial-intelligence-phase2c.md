# ADR-012: Financial Intelligence Phase 2C

## Status

Accepted

## Context

Phase 2A/2B provide source-of-truth ledger + budgets. Phase 2C must derive trends, MoM comparison, category analysis, recurring patterns, anomalies, and deterministic insights — without AI, persistence of insights, or becoming a second ledger.

## Decisions

### 1. Derived-only intelligence layer

- No `Insight` / `RecurringPattern` tables in Phase 2C.
- `FinancialIntelligenceService` computes from `transactions` (+ reuses `BudgetService` for plan-vs-actual).
- Single cohesive endpoint: `GET …/finance/analysis?month=&months=`.

### 2. Aggregation strategy

- Prefer Prisma `groupBy` / `aggregate` over loading full ledgers into JS.
- Recurring/anomaly heuristics may load a bounded expense window (e.g. last 12 months, capped) — acceptable for household scale.

### 3. Money & MoM math

- Amounts remain bigint minor units; API exposes decimal strings.
- MoM %: `null` when previous = 0; otherwise one-decimal percentage via integer tenths (same style as ADR-011).

### 4. Minimum data rules

| Capability                | Minimum                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| MoM comparison            | 2 months with expense data (or previous month exists even if 0) — % null if previous 0 |
| Spending trends UI        | Prefer ≥2 months; otherwise empty-state copy                                           |
| Recurring pattern         | ≥3 matching occurrences                                                                |
| Category spike anomaly    | ≥2 prior months with that category                                                     |
| Large-transaction anomaly | ≥10 historical expense txns for median baseline                                        |

### 5. Recurring heuristic (explainable)

Group expenses by `(categoryId, normalizedDescription)` where normalization is lowercase + collapsed whitespace.

Candidate if:

1. ≥3 occurrences in lookback window
2. Amounts within **±20%** of the group median
3. Intervals between consecutive dates mostly in **25–35 days** (monthly-ish), **or** same calendar day-of-month across ≥3 distinct months

Expose as `Likely recurring` / pattern language — never auto-create transactions.

### 6. Anomaly heuristics (calm tone)

- **Large transaction:** amount ≥ **3×** median of family’s historical expense amounts (excluding current txn).
- **Category spike:** category month spend ≥ **1.5×** average of prior months for that category (min 2 prior months).
- **Month spike:** total expenses ≥ **1.5×** average of prior months in trend window (min 2 prior months).

Severity: `INFO` | `ATTENTION` (no CRITICAL alarms).

### 7. Insight priority (max 5)

1. OVER_BUDGET / BUDGET_WARNING
2. SPENDING_INCREASE / SPENDING_DECREASE (MoM ≥10% abs)
3. CATEGORY_SPIKE / LARGE_TRANSACTION
4. RECURRING_PATTERN
5. TOP_CATEGORY (general)

### 8. Privacy

Same as ADR-010/011: no Activity/Notifications; scrub `insight|trend|anomaly|recurring` keys in Sentry.

## Consequences

- Structured analysis JSON becomes the fact layer for future AI reports.
- Phase 2D import feeds the same ledger → intelligence updates automatically.
