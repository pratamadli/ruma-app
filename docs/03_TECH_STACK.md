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

- PostgreSQL, initially using a free/low-cost managed provider such as Supabase.

## Infrastructure

- Vercel for web
- Railway/Render or equivalent for API when needed
- Supabase Storage when needed

## Email

- Resend or equivalent transactional email provider.

## Monitoring

- Sentry
- PostHog

## Monorepo

- pnpm
- Turborepo

## Principle

Start with the lowest-cost reliable infrastructure. Do not optimize for scale before scale exists.

## Related decisions

- Auth: `docs/adr/003-authentication-strategy.md`
- Monorepo: `docs/adr/002-monorepo-structure.md`
- Frontend state: `docs/adr/005-frontend-state-management.md`
- Stack evaluation: `docs/PROJECT_BRAIN_AUDIT.md`
