# ADR-007: Family Invitation & Owner Safety Rules

## Status

Accepted

## Context

Phase 1 introduces invitations and member removal. We need clear rules for email matching and ownership safety without building a full RBAC matrix.

## Decision

1. **Invitation email binding:** An invitation may only be accepted by an authenticated user whose normalized email exactly matches the invitation email. No “accept on behalf of another email” path in MVP.
2. **Invitation token:** Cryptographically random opaque token; only SHA-256 hash stored. Single-use (`PENDING` → `ACCEPTED`). Statuses: `PENDING | ACCEPTED | EXPIRED | REVOKED`.
3. **Invite permissions:** Any active member may create invitations for `ADMIN` or `MEMBER` roles. Only `OWNER`/`ADMIN` may revoke invitations or remove members.
4. **Last owner protection:** Removing a member who is the last `OWNER` is rejected (`LAST_OWNER`). Admins cannot remove owners.
5. **Email delivery:** Resend when `RESEND_API_KEY` is set; otherwise log invite URL in development.

## Consequences

- Invite accept UX must keep the invitee on the invited email.
- Ownership transfer remains a future explicit feature.
