# ADR-008: Date/time storage and task/event recurrence (Phase 1)

## Status

Accepted (updated in `1.1.1`)

## Context

Phase 1 introduces task due dates and family calendar events. Households also need simple recurrence preferences (daily bills, weekly trash, Mon/Wed/Fri workouts) without a full scheduling engine.

## Decision

1. **Storage**
   - Absolute instants (`createdAt`, event `startAt`/`endAt`, `completedAt`) use `TIMESTAMPTZ`.
   - Task `dueDate` uses SQL `DATE` (calendar day), exposed as `YYYY-MM-DD`.
2. **Family timezone**
   - `families.timezone` (IANA string) remains the household preference for display.
   - Phase 1 UI formats with the browser locale; server does not convert due dates into zoned instants yet.
3. **All-day events**
   - Represented by `allDay=true` plus `startAt` (and optional `endAt`) as timestamptz chosen by the client.
4. **Recurrence (tasks + family events)**
   - Shared preference enum: `NONE | DAILY | WEEKLY | MONTHLY | YEARLY | CUSTOM_WEEKDAYS`.
   - `CUSTOM_WEEKDAYS` uses `recurrenceWeekdays: Int[]` with **ISO weekdays** `1=Monday … 7=Sunday` (e.g. Mon/Wed/Fri → `[1,3,5]`).
   - Phase 1 **stores the preference only**. **No automatic spawning** of next occurrences.
5. **Realtime**
   - TanStack Query invalidation + light notification polling is sufficient for MVP. No WebSockets.

## Consequences

- Due-soon / overdue push notifications and occurrence materialization require a later job runner.
- Recurring automation can be layered later without rewriting the preference columns.
