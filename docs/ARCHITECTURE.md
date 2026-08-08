# RUMA — Architecture

**Status:** Accepted for Phase 0  
**Supersedes detailed implementation guidance in:** `docs/04_ARCHITECTURE.md` (index remains)  
**Related ADRs:** `docs/adr/`

---

## 1. Style

RUMA is a **modular monolith** in a **pnpm + Turborepo monorepo**.

```text
apps/web  (Next.js)  ──HTTP/JSON──►  apps/api (NestJS)  ──Prisma──►  PostgreSQL
                                         │
                                         ├── packages/types
                                         ├── packages/validation
                                         └── packages/ui (web only)
```

- Do **not** introduce microservices without a demonstrated operational need.
- PostgreSQL is the business-data source of truth.
- AI output is derived data and never silently authoritative.

---

## 2. Repository structure

```text
ruma-app/
├── apps/
│   ├── web/                 # Next.js App Router
│   └── api/                 # NestJS modular monolith
├── packages/
│   ├── ui/                  # Design tokens + shadcn-based primitives
│   ├── types/               # Shared TypeScript types / API contracts
│   ├── validation/          # Shared Zod schemas
│   └── config/              # ESLint, Prettier, TypeScript base configs
├── docs/
│   └── adr/
├── .cursor/rules/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### Why this shape

- **apps/web + apps/api:** clear client/server boundary for future mobile and integrations.
- **packages/types + validation:** single contract language across web and API.
- **packages/ui:** one design system, not duplicated Tailwind snowflakes.
- **packages/config:** consistent DX without each app inventing lint/ts rules.

Avoid creating packages until there is a second consumer. The set above is the minimum justified set.

---

## 3. Runtime architecture

### Web (`apps/web`)

- Next.js App Router.
- Server Components by default; Client Components for interactive surfaces.
- Talks to NestJS API for business operations (not directly to the database).
- Owns presentation, routing, and client-side UX state.

### API (`apps/api`)

- NestJS modules aligned to domains (`auth`, `users`, `families`, `health`, …).
- Enforces authentication and family authorization.
- Owns Prisma access and transactions.
- Exposes versioned HTTP JSON API.

### Data

- PostgreSQL via Prisma migrations.
- Production: Railway Postgres (no Docker in-repo; local = native Postgres).
- Object storage later for documents (provider TBD).

### Edge / hosting note

- Browser → Vercel (`apps/web`) uses same-origin `/v1` rewritten to Railway API (auth cookies).
- Direct public API URL remains available for health checks and non-browser clients.

---

## 4. Modular monolith rules

1. **Domain modules own their use-cases.** Controllers stay thin.
2. **No cross-module deep imports of internals.** Prefer application services / public module exports.
3. **Shared kernel is narrow:** IDs, timestamps, error shapes, auth user context, family context.
4. **Family tenancy is mandatory** for household resources.
5. **Feature flags / future domains** may exist as empty module seams only when they reduce future thrash — prefer not to stub everything.

---

## 5. Family as root aggregate

Every family-scoped resource must resolve authorization as:

1. Authenticated user.
2. Active membership in the target family.
3. Role sufficient for the operation.

Never trust client-supplied ownership claims without membership checks.

Details: `DOMAIN_MODEL.md`, `docs/adr/004-family-multi-tenancy.md`, `SECURITY.md`.

---

## 6. Cross-cutting concerns

| Concern       | Approach                                   |
| ------------- | ------------------------------------------ |
| Auth          | NestJS-owned; see ADR-003                  |
| Authorization | Guards + family membership service         |
| Validation    | Zod (shared) + Nest pipes / DTO validation |
| Errors        | Consistent JSON error envelope             |
| Logging       | Structured logs; no secrets/PII dumps      |
| Config        | Env validated at boot (Zod)                |
| Observability | Sentry when enabled; minimal PostHog later |

---

## 7. AI architecture (future constraint)

When AI arrives:

- AI modules produce **candidates / insights / recommendations**.
- Persisted business records are written only by deterministic application services after validation and, when needed, user confirmation.
- Original source material (e.g., email) is preserved for audit.
- AI never bypasses family authorization.

---

## 8. Deployment topology

| Component  | Target                                                             |
| ---------- | ------------------------------------------------------------------ |
| `apps/web` | Vercel (`NEXT_PUBLIC_API_URL=/v1` + `API_PROXY_TARGET`)            |
| `apps/api` | Railway (Nixpacks / pnpm; see `railway.toml`)                      |
| PostgreSQL | Railway Postgres (same project as API)                             |
| Email      | Resend                                                             |
| Errors     | Sentry                                                             |
| CD         | Push `main` → GitHub auto-deploy and/or `.github/workflows/cd.yml` |

Prefer low-cost reliable infrastructure. No Docker-based app runtime in this repo. Do not build Kubernetes or service meshes. Details: `docs/DEPLOYMENT.md`.

---

## 9. Change control

Significant architectural changes require an ADR under `docs/adr/`.

Update this file when the topology, package graph, or modular-monolith rules change.
