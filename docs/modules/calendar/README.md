# Family Calendar

Agenda-first shared household events.

## Capabilities

- Create / update / delete events
- `startAt` / optional `endAt` (timestamptz)
- `allDay` flag
- Optional location + description
- Recurrence preference (`NONE|DAILY|WEEKLY|MONTHLY|YEARLY|CUSTOM_WEEKDAYS` + ISO weekdays) — stored only, no auto-spawn (ADR-008)

## API

- `GET /v1/families/:familyId/events?from=`
- `POST /v1/families/:familyId/events`
- `PATCH/DELETE /v1/families/:familyId/events/:eventId`

## Activity / notifications

- Activity: `FAMILY_EVENT_CREATED|UPDATED|CANCELLED`
- Notify other active members on create (`EVENT_CREATED`)
