# RUMA — Observability (Minimal)

**Status:** Accepted through Phase 0/1 engineering complete  
**Related:** ADR-009, `DEPLOYMENT.md`

## Goals

Enough visibility to debug foundation issues without building a platform team stack.

## Implemented

### Request correlation

- API middleware assigns `requestId` (ULID) when `x-request-id` is absent.
- Response header: `x-request-id`.
- Error envelope includes `error.requestId`.

### Production logging (API)

When `NODE_ENV=production`, Nest uses a JSON logger (`JsonLogger`):

```json
{
  "level": "info",
  "message": "...",
  "context": "Bootstrap",
  "timestamp": "2026-08-08T00:00:00.000Z"
}
```

**Never log:** passwords, JWTs, refresh tokens, invitation tokens, reset tokens, Authorization headers, or future financial payloads.

### Sentry

| Surface | Package         | Env                                                                 |
| ------- | --------------- | ------------------------------------------------------------------- |
| API     | `@sentry/node`  | `SENTRY_DSN`, optional `SENTRY_ENVIRONMENT`                         |
| Web     | `@sentry/react` | `NEXT_PUBLIC_SENTRY_DSN`, optional `NEXT_PUBLIC_SENTRY_ENVIRONMENT` |

- Disabled when DSN is unset (local/CI default).
- `sendDefaultPii: false`; sensitive header/cookie/token keys scrubbed in `beforeSend`.
- Finance/import keys also scrubbed (`amount`, `balance`, `account`, `transaction`, `email`, `merchant`, `candidate`, …) — ADR-010/013.
- Import sync logs operational counts only (scanned/created/duplicates) — never bodies, amounts, or tokens.
- API captures unhandled exceptions and HTTP 5xx via the global exception filter.
- Web initializes on client mount and reports `global-error` boundary failures.

**Deploy config:** set DSNs in Railway (API) and Vercel (web). Use free-tier Sentry projects. No secrets in frontend beyond the public DSN.

### Health

- `GET /v1/health` — liveness
- `GET /v1/health/ready` — DB readiness

## Deferred

| Item                                | Why                                                 |
| ----------------------------------- | --------------------------------------------------- |
| PostHog                             | Wait for real product usage (ADR-009)               |
| Source maps upload pipeline         | Optional; add when release tracking becomes painful |
| Full APM / custom metrics warehouse | Non-goal                                            |

## Log levels

| Level          | Use                                          |
| -------------- | -------------------------------------------- |
| `error`        | Unexpected failures, email provider failures |
| `warn`         | Recoverable anomalies                        |
| `info` / `log` | Boot, notable domain events (no secrets)     |
| `debug`        | Local only                                   |
