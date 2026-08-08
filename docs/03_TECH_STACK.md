# RUMA — Technology Stack

## Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Redux Toolkit
- React Hook Form
- Zod

## Backend

- NestJS
- Prisma

## Database

- PostgreSQL via Prisma.
- Local: native PostgreSQL install (e.g. Homebrew). No Docker in this repo.
- Production: Railway Postgres (same Railway project as the API).

## Infrastructure

- Vercel for web (`apps/web`) with same-origin `/v1` rewrite to the API
- Railway for API (`apps/api`) and production Postgres
- Object storage later when needed (provider TBD; Nest remains authorization authority)
- Auto-deploy from `main` (GitHub sync and/or CD deploy hooks) — see `docs/DEPLOYMENT.md`

## Email

- Resend or equivalent transactional email provider.

## Monitoring

- Sentry
- PostHog

## Monorepo

- pnpm **10.33.4** (`packageManager`; do not use pnpm 11 on Railway/Corepack)
- Turborepo
- Node.js **22.x** (`.nvmrc`)

## Principle

Start with the lowest-cost reliable infrastructure. Do not optimize for scale before scale exists.

## Related decisions

- Auth: `docs/adr/003-authentication-strategy.md`
- Monorepo: `docs/adr/002-monorepo-structure.md`
- Frontend state: `docs/adr/005-frontend-state-management.md`
- Stack evaluation: `docs/PROJECT_BRAIN_AUDIT.md`
