# Family UX

## Routes

| Route                       | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `/app`                      | Onboarding create-family or redirect to active family |
| `/app/f/:familyId`          | Family dashboard                                      |
| `/app/f/:familyId/members`  | Members + invite + pending invites                    |
| `/app/f/:familyId/settings` | Family settings                                       |
| `/invite/:token`            | Invitation preview + accept                           |

## Shell navigation

`Home` · `Family` · `Settings` (+ family switcher when multi-family)

No placeholder nav for unimplemented modules.

## States

Screens handle loading, empty, error, unauthorized/expired/revoked/accepted invitation, and email mismatch.
