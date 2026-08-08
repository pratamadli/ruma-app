# RUMA — Database Strategy

**Status:** Accepted through Phase 1 MVP  
**Engine:** PostgreSQL  
**ORM:** Prisma  
**Related:** `docs/05_DATABASE.md` (index), `SECURITY.md`, `DOMAIN_MODEL.md`

---

## 1. Principles

1. PostgreSQL is the business-data source of truth.
2. Production hosts Postgres on Railway; local development uses a native Postgres install (no Docker in this repo). See `DEPLOYMENT.md`.
3. Family is the root tenant/workspace for household data.
4. Normalize by default; denormalize only with a measured reason.
5. Schema changes ship through Prisma migrations only.
6. Protect tenant isolation at every data-access boundary (not only in the UI).
7. Do not design every future table now — only conventions + MVP foundation.
8. Financial and other sensitive records (when introduced) must retain an auditable source.

---

## 2. Naming

| Kind          | Convention                                  | Example                |
| ------------- | ------------------------------------------- | ---------------------- |
| Tables        | `snake_case`, plural                        | `family_memberships`   |
| Columns       | `snake_case`                                | `family_id`            |
| Prisma models | `PascalCase` singular                       | `FamilyMembership`     |
| Enums         | `PascalCase` type, `SCREAMING_SNAKE` values | `MembershipRole.OWNER` |
| Foreign keys  | `<entity>_id`                               | `user_id`              |

---

## 3. Identifiers

**Decision:** Use **ULID** (lexicographically sortable, 26-char Crockford base32) stored as `TEXT` (or `CHAR(26)`).

Rationale:

- Avoids sequential ID leakage.
- Sortable by creation time without relying on a separate column for cursor pagination.
- Compatible across web/API without UUID formatting ambiguity.

Alternative rejected for MVP default: auto-increment integers (leakage / merge pain) and UUIDv4-only (fine, but ULID sorting helps feeds).

Application code generates IDs (not DB `gen_random_uuid()` as the primary pattern), so offline/test fixtures stay deterministic when needed.

---

## 4. Timestamps

Every durable business table includes:

| Column       | Type          | Notes                                                     |
| ------------ | ------------- | --------------------------------------------------------- |
| `created_at` | `timestamptz` | Required, default `now()`                                 |
| `updated_at` | `timestamptz` | Required, maintained by Prisma `@updatedAt` or equivalent |

Use UTC in the database. Convert for display in the client.

Optional per domain:

- `completed_at`, `expires_at`, `revoked_at` — domain-specific event times.

---

## 5. Soft deletion

**MVP default:** hard delete only for truly ephemeral/junk rows; prefer **soft delete** for user-facing household entities.

Convention when soft delete is used:

| Column       | Type               |
| ------------ | ------------------ |
| `deleted_at` | `timestamptz NULL` |

Rules:

- Default queries exclude `deleted_at IS NOT NULL`.
- Unique constraints that must allow reuse after delete should be partial/composite with care (document per table).
- Do not soft-delete in a way that breaks referential integrity without a plan.

Auth sessions / refresh tokens: prefer hard delete or definitive revocation timestamps.

---

## 6. Family ownership

Family-scoped tables **must** include:

```text
family_id  ->  families.id
```

Rules:

- Foreign key enforced in the database.
- Composite indexes typically start with `family_id`.
- Application services receive `familyId` from authorized context, never blindly from an unverified client claim alone.
- Avoid polymorphic “owner” patterns for MVP.

---

## 7. Foreign keys & referential integrity

- Use foreign keys for all relationships that are part of the business model.
- Prefer `ON DELETE RESTRICT` for tenant roots and important references.
- Use `ON DELETE CASCADE` only for genuine ownership children (e.g., grocery items under a list) where cascading is obvious and safe.
- When a user leaves a family, decide per resource whether to null assignee references or block removal — document at feature time.

---

## 8. Indexes

Index based on real access paths:

- Primary keys.
- Foreign keys used in joins/filters.
- Tenant list patterns: `(family_id, created_at DESC)`.
- Unique business keys: `(family_id, lower(email))` style constraints where needed.
- Invite tokens / refresh token hashes: unique index.

Do not add speculative indexes for unbuilt features.

---

## 9. Unique constraints

Examples of intended uniqueness (finalized at schema time):

- `users.email` unique (normalized lowercase).
- `family_memberships (family_id, user_id)` unique.
- Invite token hash unique.
- Refresh token hash unique.

---

## 10. Enums

- Prefer Postgres enums via Prisma enums for stable, closed sets (roles, statuses).
- Do not use enums for open-ended user tags.
- Evolving enums requires migrations — keep MVP enums small.

MVP candidates:

- `MembershipRole`: `OWNER` | `ADMIN` | `MEMBER`
- `MembershipStatus`: `ACTIVE` | `INVITED` | `REMOVED` (or invite as separate entity)

---

## 11. Auditing

**MVP**

- `created_at` / `updated_at` everywhere.
- Activity feed for human-visible household events (separate domain concept).

**Future (especially Finance)**

- Source metadata (`source_type`, `source_ref`, raw payload reference).
- Optional immutable audit tables for sensitive mutations.
- Actor user id on privileged changes.

Do not build a universal audit framework in Phase 0.

---

## 12. Migrations

1. All schema changes via Prisma Migrate.
2. Migrations are reviewed in PRs with `DATABASE.md` / module doc updates when behavior changes.
3. Never edit applied migrations on shared branches; create a new migration.
4. Keep migrations small and purposeful.
5. Seed data is optional and must be idempotent for local/dev only.

---

## 13. Transaction boundaries

- One use-case = one transaction when multiple writes must succeed/fail together (e.g., accept invite → membership active → consume token).
- Avoid long-running transactions.
- Cross-module writes go through explicit application services, not ad-hoc multi-repo calls without a transaction plan.

---

## 14. Schema (Phase 0 + Phase 1)

Migrations:

- `20260808010000_phase0_foundation`
- `20260808020000_phase1_family_workspace`
- `20260808040000_phase1_household_collaboration`
- `20260808050000_password_reset_tokens`
- `20260808060000_recurrence_weekdays` (+ `20260808061000_…_columns`)

| Table                   | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `users`                 | Identity + Argon2id password hash                                 |
| `refresh_tokens`        | Opaque refresh sessions (hashed at rest)                          |
| `password_reset_tokens` | Single-use password reset tokens (hashed at rest)                 |
| `families`              | Tenant root (`name`, `household_name`, `timezone`)                |
| `family_memberships`    | User↔Family with `OWNER`/`ADMIN`/`MEMBER`                         |
| `family_invitations`    | Email invites with hashed token + status machine                  |
| `family_activities`     | Append-only structured family activity events                     |
| `tasks`                 | Family chores (status/priority/assignee/due date/recurrence flag) |
| `grocery_lists`         | One shared list per family                                        |
| `grocery_items`         | Grocery line items + completion                                   |
| `family_events`         | Shared calendar events                                            |
| `notifications`         | In-app notifications per recipient                                |

IDs are ULID (`CHAR(26)`), generated in application code.

Date/time + recurrence rules: ADR-008. Finance tables remain future work.

---

## 15. Data sensitivity classes (forward-looking)

| Class            | Examples                                | Handling                                                                      |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Public           | Health OK                               | No auth                                                                       |
| Identity         | Email, name                             | Least privilege; never log secrets                                            |
| Household        | Chores, grocery                         | Family ACL                                                                    |
| Sensitive future | Transactions, receipts, account numbers | Encryption-at-rest via provider, strict ACL, audit source, minimize retention |

Do not store full payment credentials. Prefer references/tokens from providers if integrations appear later.
