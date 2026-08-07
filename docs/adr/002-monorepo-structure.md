# ADR-002: pnpm + Turborepo Monorepo Structure

## Status

Accepted

## Context

RUMA needs a web client, an API, shared types/validation, and a design system. The Project Brain already recommends pnpm + Turborepo. We need a structure that supports family-scoped domains and future mobile clients without premature package explosion.

## Decision

Use a monorepo:

```text
apps/web        Next.js
apps/api        NestJS
packages/ui
packages/types
packages/validation
packages/config
```

- pnpm workspaces for dependency management.
- Turborepo for task orchestration (`dev`, `build`, `lint`, `test`, `typecheck`).
- NestJS remains a modular monolith inside `apps/api` (not microservices).

## Alternatives considered

1. **Next.js-only full stack** — faster start, weaker long-term API boundary for mobile/integrations.
2. **Nx** — more powerful, more complexity than needed.
3. **Polyrepo** — premature separation cost for a founding team.

## Consequences

- Shared contracts live in `packages/types` and `packages/validation`.
- New packages require a second real consumer justification.
- CI runs at repo root via Turborepo pipelines.
