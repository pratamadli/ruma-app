# RUMA — Project Brain Audit

**Date:** 2026-08-08  
**Status:** Accepted as the foundation audit for Phase 0  
**Scope:** Documentation-only repository at audit time (no application code yet)

---

## 1. Product

### What problem RUMA solves

Running a household creates continuous cognitive load: chores, groceries, schedules, money, assets, maintenance, documents, and shared knowledge are fragmented across chats, notes, emails, and individual apps. RUMA aims to become the shared operating system that reduces that load.

### Target users

Primary: households and families who need a shared workspace (initially two or more adults coordinating daily home life).

Secondary (later): households with children/pets, more complex finance, home ownership/maintenance needs.

### Core product loop

1. Create or join a **Family** workspace.
2. Coordinate daily household work (chores, grocery, calendar).
3. Observe shared state on a calm dashboard / activity feed.
4. Over time, expand into home, finance, knowledge, and AI-assisted insights — without AI becoming the source of truth.

MVP definition from the handbook: **two people can manage their home daily.**

### MVP boundaries

**In MVP**

- Auth
- Family workspace
- Invite / membership
- Dashboard
- Chores
- Grocery
- Calendar
- Notifications
- Activity feed

**Explicitly out of MVP**

- Finance, bills, investments, net worth
- Email parsing / OCR
- Assets, maintenance, technician directory
- Documents / knowledge hub as full products
- AI assistant / monthly reports
- Marketplace booking
- Admin / subscription platform

### Future product direction

Phased expansion: Home Management → Finance → Smart Finance → RUMA AI → Complete RUMA (OCR, pantry, profiles, travel, subscriptions, admin). Service marketplace stays directory-first; booking is deferred.

---

## 2. Architecture

### Current architectural decisions (documented)

| Decision                                        | Source                               | Assessment                              |
| ----------------------------------------------- | ------------------------------------ | --------------------------------------- |
| Modular monolith                                | Architecture, Handbook, Constitution | Sound for Phase 0–3                     |
| Family as root tenant/aggregate                 | Architecture, Constitution           | Correct; needs role/membership detail   |
| PostgreSQL as business source of truth          | Architecture, Database, Constitution | Correct                                 |
| AI never authoritative for business data        | AI Guidelines, Constitution          | Correct and must be enforced in design  |
| Shared packages (UI, types, validation, config) | Architecture, Tech Stack             | Correct                                 |
| Feature-first folders                           | Handbook                             | Correct within apps                     |
| Significant changes require ADR                 | Constitution, Docs Governance        | Correct                                 |
| Premium modern Family OS design (ADR-001)       | ADR-001, UI Guidelines               | Correct; supersedes older playful style |

### Missing architectural decisions

These were not decided with enough rigor to implement safely:

1. **Authentication strategy** (provider, session model, cookie/JWT, password vs magic link vs OAuth).
2. **Multi-tenancy authorization model** (roles, invite flow, family context propagation).
3. **API versioning and error contract**.
4. **Database conventions** (IDs, soft delete, auditing, naming, migration rules).
5. **Frontend state boundaries** (when Redux is allowed vs TanStack Query / local state).
6. **Home vs Family relationship** (is Home 1:1 with Family? multi-home later?).
7. **Notification delivery channels** (in-app only for MVP? email?).
8. **Observability and secrets handling** beyond tool names.
9. **CORS, rate limiting, and environment validation strategy**.
10. **Testing strategy and CI gates**.
11. **Repository layout and package boundaries** (not yet materialized).

### Potential risks

| Risk                                                  | Severity   | Notes                                                        |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| Building features before tenant isolation is airtight | High       | Family-scoped data leaks are existential                     |
| Premature finance/AI complexity                       | High       | Attractive but out of MVP; increases security surface        |
| Split-brain auth (Supabase Auth + NestJS + Next.js)   | Medium     | Easy to invent accidentally                                  |
| Redux overuse duplicating server cache                | Medium     | DX and bug risk                                              |
| Docs drift (numbered docs vs new engineering docs)    | Medium     | Needs clear canonical homes                                  |
| UI language conflict (handbook vs ADR-001)            | Medium     | Agents may regenerate wrong aesthetic                        |
| Over-tooling the monorepo                             | Low–Medium | Hurts velocity if packages proliferate early                 |
| Low-cost infra lock-in assumptions                    | Low        | Supabase/Vercel/Railway are fine if boundaries stay portable |

### Recommended improvements

1. Produce canonical engineering docs (`ARCHITECTURE`, `DOMAIN_MODEL`, `DATABASE`, `API_ARCHITECTURE`, `FRONTEND_ARCHITECTURE`, `SECURITY`, `TESTING_STRATEGY`, `DEVELOPMENT_WORKFLOW`) and ADRs for auth, tenancy, state, and monorepo.
2. Align handbook UI language with ADR-001 (warm ivory / charcoal / sage; restrained glass).
3. Keep modular monolith; defer microservices indefinitely.
4. Scaffold apps/packages with health checks and design tokens only — no product features.
5. Treat finance-sensitive future data as a design constraint now (auditability, least privilege, no unnecessary storage).

---

## 3. Technology evaluation

### Stack under review

Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui  
State/data: Redux Toolkit, TanStack Query, React Hook Form, Zod  
Backend: NestJS, Prisma  
Database: PostgreSQL (Supabase initially)  
Infra: Vercel, Railway/Render, Supabase Storage, Resend, Sentry, PostHog  
Monorepo: pnpm, Turborepo

### Evaluations

#### 3.1 Next.js + NestJS (split apps)

1. **Current decision:** Separate web (Next.js) and API (NestJS).
2. **Problem:** More moving parts than a Next.js full-stack app for an early MVP.
3. **Alternative:** Next.js Route Handlers / Server Actions only.
4. **Trade-offs:** Split is better for future mobile clients, clearer authz boundaries, and heavier domain logic; monolith-in-Next is faster initially but harder to extract later.
5. **Recommendation:** **Keep the split.** RUMA’s future mobile + integrations + AI workers justify an explicit API boundary now.
6. **Impact of changing:** Consolidating into Next-only would simplify Phase 0 but likely force a painful extract before Phase 3–5.

#### 3.2 Redux Toolkit alongside TanStack Query

1. **Current decision:** Both are listed as standard.
2. **Problem:** Teams commonly put server cache in Redux, duplicating TanStack Query and creating stale-state bugs.
3. **Alternative:** Omit Redux; use TanStack Query + React context/local state.
4. **Trade-offs:** Redux is useful for a small set of global client concerns (active family, shell UI). Omitting it is simpler but may grow ad-hoc context.
5. **Recommendation:** **Keep Redux Toolkit, narrowly.** Server state → TanStack Query. Local UI → React state. Global client state → Redux only when justified (see ADR).
6. **Impact of changing:** Removing Redux now is low cost; introducing it later is also easy. The critical change is the **boundary rule**, not the dependency.

#### 3.3 NestJS + Prisma + PostgreSQL

1. **Current decision:** NestJS modular monolith, Prisma ORM, PostgreSQL.
2. **Problem:** None material for RUMA’s domain complexity.
3. **Alternative:** Fastify/Hono + Drizzle; or Supabase client as primary backend.
4. **Trade-offs:** NestJS is heavier but excellent for modules, guards, and long-lived domain growth. Drizzle is lighter; Supabase-as-backend blurs domain boundaries and tenant enforcement.
5. **Recommendation:** **Keep NestJS + Prisma + PostgreSQL.**
6. **Impact of changing ORM later:** High migration cost; do not churn without a concrete Prisma blocker.

#### 3.4 Supabase as managed Postgres (+ later storage)

1. **Current decision:** PostgreSQL via Supabase (low-cost).
2. **Problem:** Temptation to also adopt Supabase Auth/RLS as the primary app security model, splitting authority with NestJS.
3. **Alternative:** Neon, Railway Postgres, or local Postgres only.
4. **Trade-offs:** Supabase is cost-effective and includes storage; Neon is excellent Postgres-only DX. Either is fine if NestJS remains the authorization authority.
5. **Recommendation:** **Keep Supabase (or equivalent managed Postgres) for data/storage. Do not make Supabase Auth the system of record for RUMA authorization.**
6. **Impact of changing provider:** Low if access is only through Prisma and portable SQL.

#### 3.5 shadcn/ui + Tailwind

1. **Current decision:** Tailwind + shadcn/ui under ADR-001 design language.
2. **Problem:** Default shadcn aesthetics can drift toward generic SaaS unless tokens are owned.
3. **Alternative:** Fully custom components; or another kit.
4. **Trade-offs:** shadcn maximizes ownership and speed; custom-only slows Phase 0.
5. **Recommendation:** **Keep shadcn/ui**, but establish RUMA tokens/components in `packages/ui` before feature UI.
6. **Impact of changing:** High churn once screens exist; decide tokens now.

#### 3.6 Monitoring: Sentry + PostHog

1. **Current decision:** Sentry (errors) + PostHog (product analytics).
2. **Problem:** Both are optional cost/complexity early.
3. **Alternative:** Console/structured logs only for Phase 0; add Sentry before first external users.
4. **Trade-offs:** Early Sentry catches foundation mistakes; PostHog can wait until product usage exists.
5. **Recommendation:** **Wire Sentry placeholders in Phase 0; enable PostHog when MVP users exist.**
6. **Impact of changing:** Low.

#### 3.7 pnpm + Turborepo

1. **Current decision:** pnpm workspaces + Turborepo.
2. **Problem:** None for a two-app monorepo.
3. **Alternative:** npm/yarn workspaces; Nx.
4. **Trade-offs:** Turborepo is enough; Nx is heavier than needed.
5. **Recommendation:** **Keep pnpm + Turborepo.**
6. **Impact of changing:** Unnecessary churn.

---

## 4. Documentation contradictions and gaps

### Contradictions

1. **UI language**
   - Handbook still mentions “Blue and emerald”, “Soft glassmorphism”, and an older dashboard prompt.
   - ADR-001 + `07_UI_GUIDELINES.md` define warm ivory / charcoal / muted sage, restrained glass, and supersede the playful educational style.
   - **Resolution:** ADR-001 and UI Guidelines win. Handbook UI section should be aligned.

2. **Documentation filenames**
   - Existing brain uses numbered files (`04_ARCHITECTURE.md`, `05_DATABASE.md`, …).
   - Phase 0 deliverable introduces canonical engineering filenames (`ARCHITECTURE.md`, `DATABASE.md`, …).
   - **Resolution:** Numbered docs remain the product-brain index; detailed engineering docs become canonical for implementation. Numbered docs should point to them where expanded.

### Gaps (closed by Phase 0 docs/ADRs)

- Auth strategy
- Domain model & MVP domain boundaries
- Multi-tenancy roles
- Database conventions
- API architecture
- Frontend architecture / state policy
- Security foundation
- Testing strategy
- Development workflow / CI
- Observability minimum

### Outdated assumptions

- Any residual “HomeHub” naming is deprecated (`docs/RUMA_REBRAND.md`).
- Playful educational UI prompts are rejected.
- Microservices are not a near-term path.

---

## 5. Audit conclusion

The Project Brain is directionally strong: clear mission, sensible modular monolith, correct AI/data principles, and a coherent premium design ADR.

It is **not yet implementation-ready**. The missing decisions are exactly the ones that cause irreversible early mistakes: auth, tenancy, database conventions, API contracts, and state boundaries.

Phase 0 should document and scaffold those foundations — and deliberately avoid building chores, grocery, finance, or AI product features.
