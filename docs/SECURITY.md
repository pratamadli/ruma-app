# RUMA — Security Foundation

**Status:** Accepted through Phase 0/1 engineering complete  
**Related:** `API_ARCHITECTURE.md`, `DATABASE.md`, `docs/adr/003-authentication-strategy.md`, `docs/adr/004-family-multi-tenancy.md`, `docs/adr/009-phase01-deferred-engineering.md`

---

## 1. Security goals

RUMA will eventually handle sensitive household and financial information. Phase 0 establishes boundaries so later features do not retrofit security.

Priorities:

1. Strong authentication boundaries
2. Hard family tenant isolation
3. Input validation everywhere
4. Least privilege data retention
5. Safe secrets and logging practices

---

## 2. Environment variables & secrets

- Secrets live only in environment / secret managers — never in git.
- Provide `.env.example` files with placeholder values only.
- Validate env at process boot (API and web where applicable).
- Different secrets per environment.
- Rotate JWT/session secrets if leaked.
- Restrict production secret access to deploy environments.

---

## 3. Authentication boundaries

- NestJS is the authentication authority for API access.
- Passwords hashed with a modern KDF (Argon2id preferred).
- Short-lived access JWT (Bearer, in-memory on web) + rotatable refresh sessions (httpOnly cookie).
- Production web must use same-origin API proxy on Vercel so refresh cookies are first-party; see `DEPLOYMENT.md` and ADR-003.
- Auth endpoints rate-limited.
- Password reset uses single-use, expiring, hashed tokens; successful reset revokes refresh sessions.
- Magic link and OAuth remain deferred (ADR-009); when added, use the same hashed token / verified-email linking rules.

Details: ADR-003.

---

## 4. Authorization & family isolation

For every family-scoped operation:

1. Authenticate user.
2. Resolve target `familyId`.
3. Verify active membership (`FamilyMemberGuard`).
4. Verify role for privileged actions (invites / member admin).
5. Scope all queries by `family_id`.

Phase 1 household resources (tasks, grocery, events, dashboard) follow the same path. Cross-tenant access returns **404** (not a detailed 403) to avoid leaking existence.

Notifications are **recipient-scoped**: list/read/read-all only operate on rows where `recipient_id = current user`. `familyId` / `assignedTo` / `createdBy` from the client are never trusted without membership checks.

Household collaboration permissions stay intentionally light: any active member may create/update/complete shared tasks, grocery items, and events. Owner/admin remains required for membership management.

Additional rules:

- Never trust client-owned “I am admin of family X” claims.
- Prefer 404 over 403 when it prevents cross-tenant existence leaking for sensitive resources (choose deliberately per endpoint).
- Database foreign keys support integrity; **application guards enforce tenancy**.

---

## 5. Input validation

- Validate all external input with Zod schemas.
- Enforce max lengths and enums.
- Treat file uploads (future) with type/size constraints and virus scanning strategy later.
- Normalize emails to lowercase.

---

## 6. CORS

- Allowlist exact web origins (`CORS_ORIGINS`, e.g. `https://ruma-app-web.vercel.app`).
- Credentials enabled (refresh cookie).
- Disallow wildcard origins in production.
- Same-origin Vercel `/v1` rewrite reduces browser CORS surface for the web app; keep allowlist correct for any direct API clients.

---

## 7. Rate limiting

- Global API throttling.
- Stricter limits for `sign-in`, `sign-up`, `forgot-password`, `reset-password`, and invite creation.
- Add IP/user-based controls before public launch if abuse appears.

---

## 8. Logging rules

**Do log:** request id, route, status, latency, user id, family id, error codes.

**Do not log:** passwords, tokens, Authorization headers, raw email bodies, receipt images, bank account numbers, full card data, session cookies.

PII in logs should be minimized; prefer identifiers over emails in production logs when possible.

---

## 9. Sensitive data handling (Finance Phase 2A–2D)

- Finance is family-ACL bound (`FamilyMemberGuard`); cross-tenant → 404.
- Store minimum fields; amounts as integer minor units (ADR-010/011).
- Intelligence is derived in-memory — do not persist insights that could leak via feeds.
- Do **not** publish transaction, budget, or insight content into household Activity or Notifications.
- Sentry `beforeSend` scrubs finance/import keys including `insight|trend|anomaly|recurring|analysis|email|message|body|merchant|reference|candidate|import|gmail|oauth`.
- Never send financial details or email contents to analytics.
- Preserve `source` / `source_reference` for imports; OAuth tokens encrypted at rest; no raw email body persistence; no PAN/CVV storage.
- Connect/disconnect email: `OWNER`/`ADMIN` only. No scheduled finance notification jobs.
- Gmail OAuth `state` is HMAC-signed with TTL (ADR-014); callback requires matching family/actor.
- See [modules/finance/imports/SECURITY.md](./modules/finance/imports/SECURITY.md).

---

## 10. Dependency & supply chain hygiene

- Lockfile committed (`pnpm-lock.yaml`).
- CI installs from lockfile.
- Prefer well-maintained dependencies; avoid exotic auth packages without review.
- Run audit periodically (`pnpm audit`) before releases.

---

## 11. Security checklist for new family-scoped endpoints

- [ ] Auth guard applied
- [ ] Membership/role guard applied
- [ ] Input schema validated
- [ ] Query constrained by `family_id`
- [ ] Error response safe
- [ ] Tests cover unauthorized and cross-family access

---

## 12. Intentionally deferred

- Formal penetration test
- WAF / advanced bot management
- Field-level encryption framework
- SOC2 controls documentation
- Full immutable financial audit warehouse
