# ADR-003: Authentication Strategy

## Status

Accepted and implemented (Phase 0 foundation)

## Context

RUMA has a Next.js web app and a NestJS API. Auth must be secure, inexpensive, simple, maintainable, and compatible with family-scoped authorization. Managed providers (Clerk, Auth0, Supabase Auth) trade speed for coupling and cost.

## Decision

**NestJS owns authentication.**

Implemented capabilities:

1. Email + password (Argon2id).
2. Session model: **short-lived JWT access token** + **refresh token** (opaque random token, SHA-256 hashed at rest in PostgreSQL).
3. Refresh token delivered via **httpOnly** cookie `ruma_refresh`, path `/v1/auth`:
   - Local: `SameSite=Lax` (API on localhost).
   - Production: `Secure` + `SameSite=None` on the API; the **web app must call the API same-origin** via Next.js rewrite (`NEXT_PUBLIC_API_URL=/v1` + `API_PROXY_TARGET`) so the cookie is first-party on Vercel. Browser → Railway cross-site cookies are unreliable and look like “logged out” after navigation/reload.
4. Access token delivered to the web client **in memory** and sent as `Authorization: Bearer <token>`.
5. **Password reset:** `POST /v1/auth/forgot-password` + `POST /v1/auth/reset-password`.
   - Cryptographically random token, SHA-256 hashed at rest (`password_reset_tokens`).
   - Default TTL `PASSWORD_RESET_TTL_SECONDS` (1 hour).
   - Single-use (`usedAt`); prior unused tokens invalidated on new request.
   - Successful reset updates password and **revokes all refresh sessions**.
   - Unknown emails return the same `{ ok: true }` (no enumeration).
   - Email via existing `EmailService` / Resend (dev logs when unset).
6. Transactional email via Resend when `RESEND_API_KEY` is set (invites + password reset).
7. Magic link and OAuth (Google) are **deferred** until needed — see ADR-009.

### Password policy (MVP baseline)

- Minimum length 8.
- Email uniqueness enforced in the database.

## Alternatives considered

| Option                        | Pros                  | Cons                                          |
| ----------------------------- | --------------------- | --------------------------------------------- |
| Clerk/Auth0                   | Fast UI, hosted       | Cost, coupling, still need Nest authorization |
| Supabase Auth                 | Fits Supabase hosting | Dual authority with NestJS; RLS temptation    |
| Magic-link only               | Great UX              | Email dependency; weaker for some users       |
| Pure server sessions in Redis | Simple mental model   | Extra infra before needed                     |

## Consequences

- `auth` and `families` modules are live foundation surfaces.
- Frontend never treats third-party auth widgets as source of authorization for family data.
- Auth endpoints are rate-limited more tightly than the global API throttle.
- Production web hosting (Vercel) must proxy `/v1` to the API host; see `docs/DEPLOYMENT.md`.
- App shell navigation uses Next.js client `Link`s so in-memory access tokens survive route changes.
