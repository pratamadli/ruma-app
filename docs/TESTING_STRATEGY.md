# RUMA — Testing Strategy

**Status:** Accepted through Phase 1 MVP

---

## 1. Philosophy

Test the foundation where regressions are expensive: domain rules, authz boundaries, and shared contracts.

Do not pursue vanity coverage percentages. Prefer a small number of meaningful tests.

---

## 2. Test layers

| Layer              | Where                      | Tooling                  | Purpose                             |
| ------------------ | -------------------------- | ------------------------ | ----------------------------------- |
| Unit               | `packages/*`, api services | Vitest                   | Pure logic, validation, mappers     |
| API integration    | `apps/api`                 | Vitest + Nest + Postgres | HTTP + guards + family isolation    |
| Frontend component | `packages/ui`, `apps/web`  | Vitest + Testing Library | Primitives and critical UI behavior |
| End-to-end         | later                      | Playwright               | Full browser journeys               |

---

## 3. What is covered (Phase 0 + Phase 1)

Foundation:

1. Shared validation schema unit tests.
2. API health / DB connectivity.
3. UI primitive smoke tests.

Family + household collaboration (API integration):

- Family create → invite → accept → activity + isolation (`family-workspace.test.ts`).
- Cross-family ID access denied (`family-isolation.test.ts`).
- Tasks / grocery / calendar / notifications + isolation (`household-collaboration.test.ts`).
- Password reset: unknown email, invalid/expired/reused token, success + session revoke (`password-reset.test.ts`).

Integration tests that need DB require `DATABASE_URL` and clean up fixture users in `beforeAll`/`afterAll` (including notifications and household child tables).

---

## 4. What not to do yet

- Hundreds of snapshot tests.
- Full Playwright suite before Phase 2 UI stabilizes (manual MVP scenario remains the product check; ADR-009).
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
