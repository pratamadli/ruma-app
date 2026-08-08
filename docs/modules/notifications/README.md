# In-app Notifications

Minimal notification center for Phase 1.

## Capabilities

- List notifications for the authenticated user
- Unread count
- Mark one / mark all read
- Recipient isolation (users only see their rows)

## API

- `GET /v1/notifications`
- `PATCH /v1/notifications/:id/read`
- `POST /v1/notifications/read-all`

## Triggers (Phase 1)

| Type             | When                                             |
| ---------------- | ------------------------------------------------ |
| `TASK_ASSIGNED`  | Task assigned to another member                  |
| `TASK_COMPLETED` | Task completed (notify creator/assignee ≠ actor) |
| `EVENT_CREATED`  | Family event created (other members)             |
| `MEMBER_JOINED`  | Invite accepted (owners/admins)                  |

Email remains invite + password-reset via Resend (not a general notification channel). Due-soon/overdue reminder jobs are deferred (ADR-008, ADR-009).
