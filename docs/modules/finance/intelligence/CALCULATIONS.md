# Intelligence calculations

## Monthly trend

For each month in the window:

```text
income  = Σ INCOME
expense = Σ EXPENSE
net     = income − expense
```

Transfers excluded.

## Month-over-month

```text
difference = current − previous
percentageChange = previous == 0 ? null : difference / previous × 100
```

One decimal place via integer tenths.

## Category share

```text
percentageOfExpenses = categoryExpense / totalExpense × 100
```

## Minimum data

| Feature        | Minimum                      |
| -------------- | ---------------------------- |
| Useful MoM %   | previous month expenses > 0  |
| Trends UI      | ≥2 months with activity      |
| Recurring      | ≥3 occurrences               |
| Category spike | ≥2 prior months for category |
| Large txn      | ≥10 historical expenses      |
