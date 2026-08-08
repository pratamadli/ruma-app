# ADR-008: Date/time storage and task recurrence (Phase 1)

## Status

Accepted

## Context

Phase 1 introduces task due dates and family calendar events. We need a consistent strategy that avoids timezone bugs without building a scheduling engine.

## Decision

1. **Storage**
   - Absolute instants (`createdAt`, event `startAt`/`endAt`, `completedAt`) use `TIMESTAMPTZ`.
   - Task `dueDate` uses SQL `DATE` (calendar day in the household’s intended sense), exposed as `YYYY-MM-DD`.
2. **Family timezone**
   - `families.timezone` (IANA string) remains the household preference for display.
   - Phase 1 UI formats with the browser locale; server does not convert due dates into zoned instants yet.
3. **All-day events**
   - Represented by `allDay=true` plus `startAt` (and optional `endAt`) as timestamptz chosen by the client.
4. **Task recurrence**
   - Optional enum: `NONE | WEEKLY | MONTHLY | YEARLY`.
   - Phase 1 stores the preference only. **No automatic spawning** of next occurrences.
5. **Realtime**
   - TanStack Query invalidation + light notification polling is sufficient for MVP. No WebSockets.

## Consequences

- Due-soon / overdue push notifications require a later job runner — not in Phase 1.
- Recurring bill/chore automation can be layered later without rewriting the task table.
