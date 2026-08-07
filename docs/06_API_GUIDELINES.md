# RUMA — API Guidelines (Index)

Canonical detail: [`API_ARCHITECTURE.md`](./API_ARCHITECTURE.md).

- Backend uses NestJS.
- Validate every external input.
- Use typed DTOs / shared Zod schemas.
- Keep business logic in domain/service layers.
- Use consistent error responses (`/v1` + error envelope).
- Document public APIs.
- Enforce Family/Member authorization on every family-scoped operation.
- Never trust client-supplied family ownership.
