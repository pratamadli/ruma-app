# Family API

Base prefix: `/v1`

| Method | Path                                            | Auth        | Notes                                    |
| ------ | ----------------------------------------------- | ----------- | ---------------------------------------- |
| POST   | `/families`                                     | Bearer      | Create family + OWNER + `FAMILY_CREATED` |
| GET    | `/families`                                     | Bearer      | List memberships                         |
| GET    | `/families/:familyId`                           | Member      |                                          |
| PATCH  | `/families/:familyId`                           | Owner/Admin | Settings                                 |
| GET    | `/families/:familyId/members`                   | Member      |                                          |
| DELETE | `/families/:familyId/members/:membershipId`     | Owner/Admin | Soft-remove; last owner blocked          |
| POST   | `/families/:familyId/invitations`               | Member      | Sends email / logs URL                   |
| GET    | `/families/:familyId/invitations`               | Member      |                                          |
| DELETE | `/families/:familyId/invitations/:invitationId` | Owner/Admin | Revoke                                   |
| GET    | `/families/:familyId/activity`                  | Member      |                                          |
| GET    | `/invitations/:token`                           | Public      | Preview                                  |
| POST   | `/invitations/:token/accept`                    | Bearer      | Email must match                         |
