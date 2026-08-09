# Anomaly heuristics

| Type              | Rule                                                    |
| ----------------- | ------------------------------------------------------- |
| LARGE_TRANSACTION | amount ≥ 3× median of historical expenses (≥10 samples) |
| CATEGORY_SPIKE    | category month ≥ 1.5× average of ≥2 prior months        |
| MONTH_SPIKE       | total expenses ≥ 1.5× average of ≥2 prior months        |

Tone: “higher than usual” — not critical alerts.
