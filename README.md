# RUMA

AI-powered Household Operating System.

> Your family's second brain.

Phase 0 foundation + Phase 1 Family Workspace: auth, family create/settings, invitations, members, activity feed, design system, CI.

Former working name **HomeHub** is deprecated.

---

## Prerequisites

- Node.js 22+
- pnpm 11+
- PostgreSQL 16+ (local install or Docker)

---

## Repository layout

```text
apps/
  web/                 Next.js App Router
  api/                 NestJS modular monolith
packages/
  ui/                  Design tokens + primitives
  types/               Shared TypeScript contracts
  validation/          Shared Zod schemas
  config/              Shared ESLint/TSConfig
docs/                  Product brain + engineering docs + ADRs
```

---

## Quick start

```bash
pnpm install

# Start Postgres (pick one)
# docker compose up -d postgres
# or use a local PostgreSQL 16 instance

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit apps/api/.env with real DATABASE_URL + JWT secrets (>= 32 chars)

pnpm --filter @ruma/api exec prisma migrate deploy
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/v1/health
- API ready: http://localhost:4000/v1/health/ready
- Design system: http://localhost:3000/design-system
- App shell: http://localhost:3000/app

---

## Common commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm format

pnpm --filter @ruma/api exec prisma migrate dev
pnpm --filter @ruma/api exec prisma studio
```

---

## Foundation surfaces

### Auth

- `POST /v1/auth/sign-up`
- `POST /v1/auth/sign-in`
- `POST /v1/auth/refresh` (refresh cookie)
- `POST /v1/auth/sign-out`
- `GET /v1/auth/me`

Access token: Bearer (in-memory on web). Refresh token: httpOnly cookie.

### Family workspace

- Create / list / get / patch family
- Members list + remove
- Invitations create / list / revoke / preview / accept
- Activity feed
- Web: `/app`, `/app/f/:familyId`, members, settings, `/invite/:token`

Roles: `OWNER`, `ADMIN`, `MEMBER`. Cross-family reads → 404.

---

## Documentation

See [`docs/README.md`](./docs/README.md) and ADRs in [`docs/adr/`](./docs/adr/).

---

## Phase 0 principles

- Modular monolith first.
- Family is the tenant root.
- PostgreSQL is the business source of truth.
- AI never silently becomes authoritative data.
- Features (chores/grocery/finance/AI) come after this foundation.
