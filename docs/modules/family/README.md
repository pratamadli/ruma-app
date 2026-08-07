# Family Workspace Module

Phase 1 vertical slice for RUMA’s household tenant.

## Capabilities

- Create family (creator becomes `OWNER`)
- Family dashboard (members, quick actions, activity)
- Invite by email (secure token + Resend/dev log)
- Accept invitation (sign-up/sign-in preserved email)
- Member list / remove member
- Family settings (name, household name, timezone)
- Active family switching (client state + server membership checks)
- Activity feed foundation

## Docs

- [DOMAIN.md](./DOMAIN.md)
- [API.md](./API.md)
- [UX.md](./UX.md)

## Related ADRs

- ADR-004 Family multi-tenancy
- ADR-007 Invitation & owner safety rules
