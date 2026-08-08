# RUMA ENGINEERING HANDBOOK v1.0

> Single Source of Truth for RUMA

## Vision

RUMA is an AI-powered Household Operating System for families.

It is not a todo app.
It is not a finance app.
It is the digital operating system for a household.

## Product Philosophy

- Family-first.
- Automation over manual work.
- AI enhances, never replaces.
- Documentation is part of the product.
- Long-term maintainability beats shortcuts.

## North Star

Every feature should reduce cognitive load for families.

# Product Pillars

1. Family Workspace
2. Household Management
3. Finance
4. Assets
5. Maintenance
6. Documents
7. Knowledge Hub
8. AI Copilot
9. Timeline

# MVP

- Auth
- Family
- Invite
- Dashboard
- Chores
- Grocery
- Calendar
- Notifications
- Activity Feed

Definition:
Two people can manage their home daily.

# Version 1

- Finance
- Bills
- Documents
- Notes
- Home Profile
- Assets
- Maintenance
- Technician Directory
- Knowledge Hub

# Version 2

- Email parsing
- AI categorization
- Monthly reports
- Budget prediction
- Investments
- Insurance
- Net Worth
- Home Timeline

# Complete Product

- OCR
- Pantry
- Child profile
- Pet profile
- Travel
- Family goals
- Subscription
- Admin Portal

# Recommended Tech

Frontend:

- Next.js App Router
- React
- TypeScript
- Tailwind
- shadcn/ui
- TanStack Query
- Redux Toolkit
- React Hook Form
- Zod

Backend:

- NestJS
- Prisma

Database:

- PostgreSQL (Railway Postgres in production; native local install)

Deployment:

- Vercel (web; same-origin `/v1` rewrite to API)
- Railway (API + Postgres)
- Auto-deploy from `main` (see `docs/DEPLOYMENT.md`)
- Object storage later when needed
- No Docker in this repo

Email:

- Resend

Monitoring:

- Sentry
- PostHog

Monorepo:

- Turborepo
- pnpm 10.33.4
- Node.js 22.x

# Architecture Principles

- Modular monolith first.
- No microservices.
- PostgreSQL is source of truth.
- AI never writes business data directly.
- Family is root aggregate.
- Shared types.
- Shared UI.
- Feature-first folders.

# AI Principles

AI may:

- categorize
- summarize
- recommend
- predict

AI must not:

- invent financial records
- mutate data without explicit action
- become source of truth

# Documentation Constitution

Every change updates docs.

Database => DATABASE.md
API => API.md
Feature => module docs
Architecture => ADR
Roadmap => ROADMAP

Definition of Done:

- Code
- Tests
- Docs
- Migration
- Changelog

# Cursor Architect Rules

Before coding:
1 Read Vision
2 Read PRD
3 Read Architecture
4 Read ADR
5 Perform Impact Analysis

After coding:

- Update docs
- Explain decisions
- Never violate architecture

# Home Profile

RUMA models a real home:
House, rooms, assets, maintenance, contacts, timeline.

# Killer Features

- Family workspace
- Email transaction parser
- AI monthly household report
- Household knowledge hub
- Home timeline
- Technician directory
- Asset management
- Net worth dashboard

# UI Direction

Canonical: `docs/07_UI_GUIDELINES.md` and `docs/adr/001-ruma-design-direction.md`.

Modern premium household OS:

- Soft UI Evolution foundation
- Minimalism & Swiss structure
- Selective Bento Grid
- Selective AI-Native + subtle Organic warmth
- Warm ivory / charcoal / muted sage (not playful educational UI)
- Restrained elevation; glass only sparingly
- Large spacing, accessible

Base prompt: use the canonical prompt in `docs/07_UI_GUIDELINES.md`.

# Engineering Goal

Build software that is still maintainable after five years.

# Final Constitution

1. Protect architecture.
2. Protect developer experience.
3. Build for years.
4. Prefer simplicity.
5. Every feature has documentation.
6. Every architectural change requires ADR.
7. Documentation is a first-class artifact.
8. AI is an assistant, never the owner of data.
9. Family is always the center.
10. RUMA should become the family's second brain.
