# Tasks / Chores

Family-scoped household tasks for Phase 1 MVP.

## Capabilities

- Create / list / update / delete
- Assign to an active member
- Status: `TODO` | `IN_PROGRESS` | `COMPLETED`
- Priority + optional due date (`YYYY-MM-DD`)
- Recurrence preference stored (`NONE|WEEKLY|MONTHLY|YEARLY`) — no auto-spawn (ADR-008)

## API

- `GET/POST /v1/families/:familyId/tasks`
- `GET/PATCH/DELETE /v1/families/:familyId/tasks/:taskId`

## Activity / notifications

- Activity: `TASK_CREATED`, `TASK_ASSIGNED`, `TASK_COMPLETED`
- In-app notification on assign (assignee) and complete (creator/assignee ≠ actor)
