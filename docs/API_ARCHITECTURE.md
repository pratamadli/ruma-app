# RUMA — API Architecture

**Status:** Accepted through Phase 2B Budgeting  
**Runtime:** NestJS in `apps/api`  
**Related:** `docs/06_API_GUIDELINES.md`, `SECURITY.md`, `docs/adr/003-authentication-strategy.md`, `docs/adr/008-datetime-and-task-recurrence.md`

---

## 1. Goals

- Clear module boundaries aligned to domains.
- Consistent validation and errors.
- Mandatory authn/authz for family-scoped resources.
- Small initial surface: health + scaffolding seams for auth/users/families.

---

## 2. Module layout (initial)

```text
apps/api/src/
├── main.ts
├── app.module.ts
├── config/
├── common/
├── prisma/
├── health/
├── auth/
├── users/
├── families/               # memberships, invites, activity
├── tasks/
├── grocery/
├── calendar/
├── notifications/          # user inbox (not family-id in path)
├── household/              # dashboard aggregation
└── finance/                # accounts, transactions, categories, summary
```

### Module rules

- Controllers: HTTP mapping only.
- Services: use-cases and transactions.
- Prisma access: through `PrismaService` (or repository helpers if a module needs them).
- No business logic in controllers or DTOs.

---

## 3. Versioning

**Decision:** URL prefix `/v1`.

```text
GET /v1/health
POST /v1/auth/sign-in
GET /v1/families/:familyId
```

- Breaking changes require `/v2` or additive compatible evolution under `/v1`.
- Do not version via headers for MVP.

---

## 4. DTO & validation conventions

- External input validated at the boundary.
- Prefer **Zod schemas** in `packages/validation`, reused by API and web where shared.
- NestJS can wrap Zod with a Zod validation pipe; class-validator is not the preferred long-term standard for shared contracts.
- Naming:
  - `CreateFamilyInput`
  - `FamilyResponse`
  - Avoid leaking Prisma models directly as API responses.

Response DTOs should be explicit and stable.

---

## 5. Error format

All errors use a consistent envelope:

```json
{
  "error": {
    "code": "FAMILY_NOT_FOUND",
    "message": "Family not found.",
    "details": [],
    "requestId": "01H..."
  }
}
```

Rules:

- `code` is machine-readable and stable.
- `message` is human-readable and safe to show.
- `details` optional field-level validation issues.
- Never include stack traces in production responses.
- Map domain errors → HTTP status:

| Status | Use                                                                         |
| ------ | --------------------------------------------------------------------------- |
| 400    | Validation / bad input                                                      |
| 401    | Unauthenticated                                                             |
| 403    | Authenticated but not allowed                                               |
| 404    | Not found (or not visible — avoid cross-tenant existence leaks when needed) |
| 409    | Conflict                                                                    |
| 429    | Rate limited                                                                |
| 500    | Unexpected                                                                  |

---

## 6. Authentication & authorization

### Authentication

- NestJS verifies session/access token (see ADR-003).
- `@CurrentUser()` decorator provides identity.
- Public routes explicitly marked.

### Authorization

- Family-scoped routes require membership check.
- Prefer route shape that includes `familyId` when operating inside a family:

```text
/v1/families/:familyId/tasks
```

- Guards:
  - `AuthGuard` — valid identity required.
  - `FamilyMemberGuard` — active membership required.
  - Optional `RolesGuard` — `OWNER`/`ADMIN`/`MEMBER` for privileged ops.

Never trust a client-provided `familyId` without membership verification.

---

## 7. Family context propagation

1. Client selects active family (stored as client global state).
2. Client calls family-scoped endpoints with that `familyId`.
3. API loads membership for `(userId, familyId)`.
4. Service executes with authorized `FamilyContext`.

Do not infer family solely from “user’s first family” for mutating operations.

---

## 8. Logging

- Structured JSON logs in production.
- Include `requestId`, route, status, latency.
- Include `userId` / `familyId` when available.
- Never log passwords, tokens, raw email bodies, or future financial payloads.

---

## 9. Configuration & environment

Validated at boot via Zod (see `packages/validation` or `apps/api` config schema).

Minimum variables (Phase 0):

| Variable             | Purpose                                |
| -------------------- | -------------------------------------- |
| `NODE_ENV`           | `development` / `test` / `production`  |
| `PORT`               | API port                               |
| `DATABASE_URL`       | Postgres connection                    |
| `CORS_ORIGINS`       | Allowed web origins (comma-separated)  |
| `JWT_ACCESS_SECRET`  | Access token secret (when auth lands)  |
| `JWT_REFRESH_SECRET` | Refresh token secret (when auth lands) |
| `APP_URL`            | Web app URL for links                  |
| `SENTRY_DSN`         | Optional                               |

Missing/invalid env fails fast.

---

## 10. CORS

- Explicit allowlist from `CORS_ORIGINS`.
- Credentials enabled if cookie-based refresh is used.
- No `*` with credentials.

---

## 11. Rate limiting

- Global basic rate limit at API gateway/framework level (e.g., Nest throttler).
- Stricter limits on auth endpoints (`sign-in`, `sign-up`, magic link).
- Exact numbers tunable; start conservative in production.

---

## 12. Health

- `GET /v1/health` — process liveness.
- Optional `GET /v1/health/ready` — DB connectivity for readiness probes.

Do not expose internals.

---

## 13. Documentation

- Public/stable endpoints documented in module docs as they appear.
- OpenAPI optional later; not a Phase 0 blocker if DTOs/contracts are clear in `packages/types`.

---

## 14. Implemented surface (Phase 0–2A)

### Foundation

| Method | Path                       | Auth                    |
| ------ | -------------------------- | ----------------------- |
| GET    | `/v1/health`               | Public                  |
| GET    | `/v1/health/ready`         | Public                  |
| POST   | `/v1/auth/sign-up`         | Public                  |
| POST   | `/v1/auth/sign-in`         | Public                  |
| POST   | `/v1/auth/refresh`         | Public (refresh cookie) |
| POST   | `/v1/auth/sign-out`        | Public (refresh cookie) |
| POST   | `/v1/auth/forgot-password` | Public (throttled)      |
| POST   | `/v1/auth/reset-password`  | Public (throttled)      |
| GET    | `/v1/auth/me`              | Bearer                  |
| POST   | `/v1/families`             | Bearer                  |
| GET    | `/v1/families`             | Bearer                  |
| GET    | `/v1/families/:familyId`   | Bearer + membership     |

### Household collaboration (Phase 1)

| Method           | Path                                             | Auth                |
| ---------------- | ------------------------------------------------ | ------------------- |
| GET              | `/v1/families/:familyId/dashboard`               | Bearer + membership |
| GET/POST         | `/v1/families/:familyId/tasks`                   | Bearer + membership |
| GET/PATCH/DELETE | `/v1/families/:familyId/tasks/:taskId`           | Bearer + membership |
| GET              | `/v1/families/:familyId/grocery`                 | Bearer + membership |
| POST             | `/v1/families/:familyId/grocery/items`           | Bearer + membership |
| PATCH/DELETE     | `/v1/families/:familyId/grocery/items/:itemId`   | Bearer + membership |
| POST             | `/v1/families/:familyId/grocery/clear-completed` | Bearer + membership |
| GET/POST         | `/v1/families/:familyId/events`                  | Bearer + membership |
| PATCH/DELETE     | `/v1/families/:familyId/events/:eventId`         | Bearer + membership |
| GET              | `/v1/notifications`                              | Bearer (recipient)  |
| PATCH            | `/v1/notifications/:notificationId/read`         | Bearer (recipient)  |
| POST             | `/v1/notifications/read-all`                     | Bearer (recipient)  |

Guards: global `AuthGuard`, `FamilyMemberGuard`, `RolesGuard`, Nest throttler.

Notifications are recipient-scoped: the API never returns another user’s inbox rows.

### Household finance (Phase 2A)

| Method           | Path                                                    | Auth                |
| ---------------- | ------------------------------------------------------- | ------------------- |
| GET/POST         | `/v1/families/:familyId/finance/accounts`               | Bearer + membership |
| PATCH            | `/v1/families/:familyId/finance/accounts/:accountId`    | Bearer + membership |
| GET/POST         | `/v1/families/:familyId/finance/categories`             | Bearer + membership |
| PATCH            | `/v1/families/:familyId/finance/categories/:categoryId` | Bearer + membership |
| GET/POST         | `/v1/families/:familyId/finance/transactions`           | Bearer + membership |
| GET/PATCH/DELETE | `/v1/families/:familyId/finance/transactions/:id`       | Bearer + membership |
| GET              | `/v1/families/:familyId/finance/summary`                | Bearer + membership |

Money fields are decimal **strings** (minor units). See [modules/finance/API.md](./modules/finance/API.md).

### Household budgeting (Phase 2B)

| Method           | Path                                               | Auth                |
| ---------------- | -------------------------------------------------- | ------------------- |
| GET/POST         | `/v1/families/:familyId/finance/budgets`           | Bearer + membership |
| GET/PATCH/DELETE | `/v1/families/:familyId/finance/budgets/:budgetId` | Bearer + membership |

See [modules/finance/budgeting/API.md](./modules/finance/budgeting/API.md).

Do **not** implement email import / AI finance endpoints until Phase 2C–2D.
