# RUMA — Database Principles (Index)

Canonical detail: [`DATABASE.md`](./DATABASE.md).

PostgreSQL is the default database.

Principles:

- Normalize business data unless denormalization has a clear reason.
- Family is the root tenant/workspace.
- Every financial record has an auditable source.
- Use migrations for schema changes.
- Avoid duplicated sources of truth.
- Index based on real query patterns.
- Protect tenant isolation at every data-access boundary.

Any schema change must update database documentation and migration history.
