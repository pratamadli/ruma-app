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
3. Refresh token delivered via **httpOnly, Secure (production), SameSite=Lax** cookie named `ruma_refresh`, path `/v1/auth`.
4. Access token delivered to the web client **in memory** and sent as `Authorization: Bearer <token>`.
5. Magic link and OAuth (Google) remain planned extensions.
6. Transactional email via Resend deferred until verification/reset flows land.

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
