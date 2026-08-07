# ADR-005: Frontend State Management Boundaries

## Status

Accepted

## Context

The Project Brain lists both TanStack Query and Redux Toolkit. Without boundaries, server cache ends up duplicated in Redux, increasing bugs and complexity.

## Decision

| State kind                 | Tool                  |
| -------------------------- | --------------------- |
| Server/async remote state  | TanStack Query        |
| Local UI state             | React component state |
| Form state                 | React Hook Form + Zod |
| Narrow global client state | Redux Toolkit         |

### Redux is allowed for

- Active family id / family switcher selection
- Cross-route shell UI state that is not server state

### Redux is not for

- API entity caches
- Form fields
- Derived server data
- Auth identity cache that should come from session/bootstrap endpoints (may use a tiny auth slice only if clearly justified)

## Consequences

- `apps/web` may include a Redux store shell in Phase 0.
- Feature code reviews should reject server-state-in-Redux patterns.
- If Redux remains unused after MVP shell work, removal is acceptable via a later ADR note.
