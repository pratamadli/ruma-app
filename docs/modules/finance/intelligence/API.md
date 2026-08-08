# Intelligence API

```text
GET /v1/families/:familyId/finance/analysis?month=YYYY-MM&months=6
```

Returns: `summary`, `comparison`, `trend`, `topCategories`, `categoryChanges`, `budget`, `recurring`, `anomalies`, `insights`.

All amounts are minor-unit strings. Auth: JWT + `FamilyMemberGuard` (404 cross-tenant).
