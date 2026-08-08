# RUMA — Domain Model

**Status:** Accepted for Phase 0  
**Related:** `ARCHITECTURE.md`, `docs/adr/004-family-multi-tenancy.md`

---

## 1. Purpose

Define initial domain boundaries, MVP ownership, dependencies, and bounded contexts before schema proliferation.

This document does **not** prescribe every future table. It defines where concepts live and who owns them.

---

## 2. Core tenancy model

```text
User
  ↓
FamilyMembership
  ↓
Family
  ↓
Household Data (family-scoped resources)
```

- **User** is a global identity.
- **Family** is the household workspace and tenant root.
- **FamilyMembership** links a user to a family with a role.
- Almost all product data is **family-scoped**.

---

## 3. Bounded contexts

| Context             | Owns                                                         | Notes                                                           |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| **Identity / Auth** | Credentials, sessions, password reset, OAuth links           | Global; not family-scoped                                       |
| **User**            | Profile basics (name, avatar, preferences that are personal) | Global identity; preferences may later split personal vs family |
| **Family**          | Family aggregate, settings, membership, invites              | Tenant root                                                     |
| **Membership**      | Roles, invitations, join/leave                               | Belongs with Family context operationally                       |
| **Home**            | Physical home profile, rooms                                 | Future; related 1:1 to Family for MVP/V1 assumption             |
| **Tasks (Chores)**  | Chore definitions, assignments, completions                  | MVP                                                             |
| **Grocery**         | Lists, items, checked state                                  | MVP                                                             |
| **Calendar**        | Household events / shared schedule                           | MVP                                                             |
| **Notifications**   | In-app notification records, read state                      | MVP (delivery channels evolve)                                  |
| **Activity**        | Family activity feed events                                  | MVP                                                             |
| **Finance**         | Accounts, transactions, categories, summaries; budgets later | Phase 2A live; high sensitivity (ADR-010)                       |
| **Assets**          | Owned items, warranties                                      | Future                                                          |
| **Maintenance**     | Schedules, service history                                   | Future                                                          |
| **Documents**       | Files metadata, links to storage                             | Future                                                          |
| **Knowledge**       | Notes, household knowledge hub                               | Future                                                          |
| **AI**              | Derived insights, suggestions, parse candidates              | Cross-cutting; never source of truth                            |

---

## 4. MVP vs future

### MVP domains

| Domain         | MVP scope                                                       |
| -------------- | --------------------------------------------------------------- |
| Auth           | Sign up, sign in, session, sign out, password reset             |
| User           | Minimal profile                                                 |
| Family         | Create family, family settings (minimal)                        |
| Membership     | Owner/admin/member roles, invite by email/link                  |
| Dashboard      | Composition surface over MVP data (not its own write model)     |
| Tasks / Chores | Create, assign, complete, list                                  |
| Grocery        | Shared list CRUD + check-off                                    |
| Calendar       | Shared events CRUD + basic views                                |
| Notifications  | In-app notifications for membership and task-relevant events    |
| Activity Feed  | Append-only family activity events for recent household actions |

### Future domains (do not implement in Phase 0/1 beyond seams)

Home/Assets/Maintenance/Documents/Knowledge (Phase 3+), Finance budgets & automation (Phase 2B–2D), AI Copilot, Timeline, Pantry, Profiles (child/pet), Travel, Subscriptions/Admin, Service marketplace booking.

---

## 5. Key aggregates (conceptual)

### User

- Identity record referenced by memberships and personal auth.

### Family

- Root workspace aggregate.
- Owns memberships and is the authorization boundary for household data.

### FamilyMembership

- `(familyId, userId)` uniqueness.
- Role: `OWNER` | `ADMIN` | `MEMBER` (MVP).
- Status: `ACTIVE` | `INVITED` | `REMOVED` (exact enum finalized at schema time).

### Invite

- Tokenized invitation to join a family.
- Expires; consumable once.

### Chore / Task

- Family-scoped work item.
- Optional assignee (membership/user).
- Completion events may emit Activity + Notification.

### GroceryList / GroceryItem

- Family-scoped list(s); MVP may start with one default list per family.

### CalendarEvent

- Family-scoped event with time range and optional attendees.

### Notification

- Per-user, usually derived from a family event; visibility still respects membership.

### ActivityEvent

- Family-scoped audit/timeline-lite record for the feed (not a full security audit log).

---

## 6. Dependencies

```text
Auth ──► User
User ──► FamilyMembership ──► Family
Family ◄── Tasks / Grocery / Calendar / Activity / Notifications
Finance (Phase 2A) ──depends on──► Family
Home / Assets / Maintenance / Documents / Knowledge (future) ──depend on──► Family
AI (future) ──reads──► family-scoped domains; writes only proposal/candidate records
```

Rules:

- No family-scoped domain may exist without a `familyId` ownership path.
- Auth must not embed household business rules beyond identity.
- AI depends on other domains; other domains must not depend on AI to function.

---

## 7. Ownership boundaries

| Concern                        | Owner module (NestJS)                 | Notes                                                          |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------- |
| Credentials / sessions         | `auth`                                | Issues tokens/sessions                                         |
| User profile                   | `users`                               | No family ACL here except “self”                               |
| Family + invites + memberships | `families` (+ `memberships` if split) | Tenant administration                                          |
| Chores                         | `tasks`                               | Family ACL on every operation                                  |
| Grocery                        | `grocery`                             | Family ACL                                                     |
| Calendar                       | `calendar`                            | Family ACL                                                     |
| Notifications                  | `notifications`                       | User inbox + family origin checks                              |
| Activity                       | `activity`                            | Family ACL; append from other modules via application services |
| Health / ops                   | `health`                              | Public/liveness only                                           |

Dashboard is a **frontend composition**, not a backend domain module.

---

## 8. Home vs Family (decision for now)

**Assumption for V1:** one primary Home profile per Family.

- Family = social/tenant workspace.
- Home = physical dwelling metadata (address, rooms, etc.).

Multi-home households are intentionally undecided. Do not model multi-home until a real requirement appears. Reserve the `Home` context so Assets/Maintenance can attach later without overloading `Family`.

---

## 9. Roles (MVP)

| Role     | Capabilities (MVP intent)                                              |
| -------- | ---------------------------------------------------------------------- |
| `OWNER`  | Full control including transfer/delete family (delete may be deferred) |
| `ADMIN`  | Manage members/invites and all household data                          |
| `MEMBER` | Read/write household MVP data; cannot manage membership admin actions  |

Future roles (e.g., child, guest, read-only) are out of MVP. See `docs/adr/004-family-multi-tenancy.md`.

---

## 10. Activity vs audit vs AI

| Concept                     | Purpose                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Activity feed               | Human-facing “what happened in our home”                                                               |
| Security/audit log (future) | Tamper-resistant operational audit for sensitive actions                                               |
| AI proposals                | Derived candidates/insights with confidence; require confirmation when they would become business data |

Do not collapse these three into one table conceptually.

---

## 11. Explicit non-goals for Phase 0

- No domain table implementation beyond what scaffolding needs to prove Prisma/migrations.
- No finance schema.
- No AI persistence schema.
- No cross-family sharing or org-level tenancy above Family.
