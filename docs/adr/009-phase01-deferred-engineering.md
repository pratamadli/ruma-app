# ADR-009: Phase 0/1 deferred engineering items

## Status

Accepted

## Context

Phase 0 + Phase 1 **product scope** is complete. Remaining items from docs/audits fall into security hardening, observability, auth extensions, and optional DX. Not all are worth implementing before Phase 2 (Home Management).

## Decision

### Implement before Phase 2 (done in this hardening pass)

| Item                                  | Rationale                                              |
| ------------------------------------- | ------------------------------------------------------ |
| Password reset                        | Required recovery path; already implied by SECURITY.md |
| Sentry (API + web)                    | Required before external users; env-gated              |
| Production JSON logging + `requestId` | Completes Phase 0 observability seams                  |
| Migration/CI verification             | Phase 1 schema must be deployable                      |

### Intentionally deferred

| Item                        | Rationale                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Magic link                  | Password + reset is sufficient; adds email-auth surface without Phase 2 value                   |
| Google OAuth                | Needs account-linking rules + console setup; not needed for household MVP users                 |
| PostHog                     | Wait until real product usage; avoid PII analytics early                                        |
| Notification reminder jobs  | Needs scheduler; ADR-008 already deferred due-soon/overdue                                      |
| Recurring task auto-spawn   | Preference stored only; avoid scheduling engine before Home Management                          |
| Full server timezone engine | ADR-008 DATE + timestamptz strategy is adequate                                                 |
| OpenAPI                     | Contract lives in `@ruma/types` + Zod; OpenAPI optional until external API consumers            |
| Playwright E2E              | API integration tests cover critical authz/isolation; browser E2E when UI stabilizes in Phase 2 |
| WebSockets                  | Query invalidation + light polling sufficient                                                   |

## Consequences

- Roadmap marks Phase 0 and Phase 1 **COMPLETE** with an explicit deferred list.
- Phase 2 must not assume magic link, OAuth, or reminder jobs exist.
- Reminder/recurrence jobs should be reconsidered when Home Management introduces maintenance schedules.
