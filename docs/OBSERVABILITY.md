# RUMA — Observability (Minimal)

**Status:** Accepted for Phase 0

## Goals

Enough visibility to debug foundation issues without building a platform team stack.

## Phase 0

- Structured application logs on API (Nest logger → JSON in production later).
- Consistent API error envelope with `requestId` (wired as headers land).
- Frontend surfaces API health on the foundation landing page.

## Near-term (before external users)

- **Sentry** for API + web error tracking when `SENTRY_DSN` is present.
- Do not send PII/secrets to Sentry breadcrumbs.

## Later (MVP usage)

- **PostHog** for product analytics (opt-in / privacy-conscious events).
- Basic performance signals (web vitals, API latency logs).

## Non-goals now

- Full APM
- Custom metrics warehouse
- Log sampling platforms beyond provider free tiers
