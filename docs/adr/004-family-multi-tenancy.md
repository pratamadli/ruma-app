# ADR-004: Family Multi-Tenancy & Roles

## Status

Accepted

## Context

Family is the fundamental household workspace. Every household resource needs a clear authorization boundary. Role complexity must stay minimal for MVP while leaving room for child/guest roles later.

## Decision

### Tenant model

```text
User → FamilyMembership → Family → Household Data
```

- A user may belong to multiple families.
- One **active family** is a client concern (Redux/global client state), not a server-global setting.
- All household data rows include `family_id` and are queried with membership-checked `familyId`.

### MVP roles

| Role     | Membership admin                                                          | Household data                |
| -------- | ------------------------------------------------------------------------- | ----------------------------- |
| `OWNER`  | Yes (including ownership transfer later)                                  | Full                          |
| `ADMIN`  | Yes (invite/remove/role change except elevating above self without rules) | Full                          |
| `MEMBER` | No                                                                        | Read/write MVP household data |

### Invites

- Email/link invites create a pending invite token bound to `family_id`.
- Accepting an invite creates/activates membership.
- Invites expire and are single-use.

### Enforcement

- Database: FK + `family_id` on family-scoped tables.
- Application: `AuthGuard` + `FamilyMemberGuard` (+ role checks for admin operations).
- Never trust client-provided ownership without membership verification.

## Alternatives considered

1. **Row Level Security as primary enforcement** — useful defense in depth later; not a substitute for Nest guards while Prisma is the access path.
2. **Org → Family hierarchy** — unnecessary for MVP households.
3. **Fine-grained permission matrix** — premature; roles suffice.

## Consequences

- Cross-family access tests are mandatory when family APIs land.
- Future roles (child, guest, read-only) require an ADR additive change.
- Home/Finance/etc. attach under Family, not under User.
