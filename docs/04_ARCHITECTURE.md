# RUMA — Architecture (Index)

Canonical engineering detail: [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md), [`docs/adr/`](./adr/).

## Architecture Style

Start as a modular monolith.

Do not introduce microservices unless there is a demonstrated operational or scaling reason.

## Core Domain

Family Workspace is the root household context.

Major bounded contexts:

- Auth
- Family
- Home
- Tasks
- Grocery
- Calendar
- Finance
- Assets
- Maintenance
- Documents
- Knowledge
- Notifications
- AI

## Source of Truth

PostgreSQL is the business-data source of truth.

AI output is derived information and must never silently become authoritative business data.

## Shared Packages

Use shared packages for:

- UI
- Types
- Validation
- Utilities
- Configuration

## Architecture Change

Significant architectural changes require an ADR under `docs/adr/`.
