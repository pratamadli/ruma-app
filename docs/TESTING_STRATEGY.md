# RUMA — Testing Strategy

**Status:** Accepted for Phase 0

---

## 1. Philosophy

Test the foundation where regressions are expensive: domain rules, authz boundaries, and shared contracts.

Do not pursue vanity coverage percentages. Prefer a small number of meaningful tests.

---

## 2. Test layers

| Layer              | Where                      | Tooling (Phase 0)        | Purpose                                  |
| ------------------ | -------------------------- | ------------------------ | ---------------------------------------- |
| Unit               | `packages/*`, api services | Vitest                   | Pure logic, validation, mappers          |
| API integration    | `apps/api`                 | Vitest + Nest testing    | HTTP + guards + (later) DB               |
| Frontend component | `packages/ui`, `apps/web`  | Vitest + Testing Library | Primitives and critical UI behavior      |
| End-to-end         | later                      | Playwright               | Critical user journeys before MVP launch |

---

## 3. What to test in Phase 0

Minimum demonstrations:

1. Shared validation schema unit test (e.g., env or email normalization helper).
2. API health endpoint test.
3. UI primitive smoke test (e.g., Button renders).

When Auth/Family land, add first-class tests for:

- Unauthenticated access denied.
- Cross-family access denied.
- Role-gated invite/admin actions.

---

## 4. What not to do yet

- Hundreds of snapshot tests.
- E2E suite before auth + family flows exist.
- Visual regression platform.
- Load testing.

---

## 5. Conventions

- Test files: `*.test.ts` / `*.test.tsx` colocated or under `__tests__` when clearer.
- Use factories/fixtures for entities once domains exist.
- Integration tests that need DB use a dedicated test database, never production.
- CI runs unit/integration tests on every PR.

---

## 6. Definition of done (testing slice)

A change that alters business rules or authz must include tests that would fail if the rule regressed.
