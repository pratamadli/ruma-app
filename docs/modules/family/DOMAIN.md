# Family Domain

## Aggregates

### Family

- `name` (required)
- `householdName` (optional)
- `timezone` (default `UTC`)
- soft delete via `deletedAt`

### FamilyMembership

- unique `(familyId, userId)`
- roles: `OWNER | ADMIN | MEMBER`
- status: `ACTIVE | REMOVED` (invite pending lives on invitation, not membership)

### FamilyInvitation

- bound to `familyId` + invitee `email`
- role offered: `ADMIN | MEMBER`
- token hash, expiry, status machine

### FamilyActivity

- append-only feed events
- `type` string + `metadata` JSON
- presentation strings are mapped in the app layer

## Authorization pattern

```text
Authenticated user → active membership → role check → mutate/read
```

Cross-tenant access returns **404** for family-scoped reads.
