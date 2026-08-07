# ADR-006: API Versioning & Error Envelope

## Status

Accepted

## Context

RUMA needs a stable client/server contract for web (and later mobile). Ad-hoc error shapes and unversioned endpoints create avoidable churn.

## Decision

1. All public HTTP API routes are prefixed with `/v1`.
2. Errors use a single JSON envelope:

```json
{
  "error": {
    "code": "MACHINE_CODE",
    "message": "Human-safe message",
    "details": [],
    "requestId": "01H..."
  }
}
```

3. Shared response/input types live in `packages/types` and Zod schemas in `packages/validation`.

## Consequences

- Nest global filter maps exceptions to the envelope.
- Breaking changes require `/v2` or careful additive evolution.
- Clients branch on `error.code`, not brittle message strings.
