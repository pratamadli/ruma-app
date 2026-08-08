# RUMA — Frontend Architecture

**Status:** Accepted for Phase 0  
**Runtime:** Next.js App Router in `apps/web`  
**Related:** `docs/07_UI_GUIDELINES.md`, `docs/adr/001-ruma-design-direction.md`, `docs/adr/005-frontend-state-management.md`

---

## 1. Goals

- Calm, premium household OS UI (ADR-001).
- Clear server/client component boundaries.
- Predictable data fetching without Redux-as-a-cache.
- Shared types/validation/UI packages.
- Accessibility and responsive behavior from day one.

---

## 2. App structure (initial)

```text
apps/web/src/
├── app/                      # App Router routes
│   ├── layout.tsx
│   ├── page.tsx              # marketing/landing placeholder
│   ├── (auth)/               # future auth routes
│   └── (app)/                # future authenticated shell
├── components/               # web-specific compositions
├── features/                 # feature folders when features exist
├── lib/                      # api client, query client, utils
└── styles/                   # global CSS / token imports
```

Shared primitives live in `packages/ui`.

---

## 3. Server vs Client Components

| Default                    | Server Components                                                          |
| -------------------------- | -------------------------------------------------------------------------- |
| Use Client Components when | Browser interactivity, local state, subscriptions, certain auth UI widgets |

Rules:

- Fetch private user data through the API with explicit auth; do not treat Server Components as a free pass around Nest authorization.
- Keep client bundles small; push static shell to the server.
- Do not mark layouts client-wide without reason.

---

## 4. Data fetching strategy

### Server state → TanStack Query

Examples: family list, chores, grocery items, calendar events, notifications.

Patterns:

- Query keys include `familyId` and resource identity.
- Mutations invalidate/update related queries.
- Prefer API client functions in `lib/api` returning typed responses from `packages/types`.

### Local UI state → React state

Examples: open/closed dialogs, ephemeral form step, hover/focus local UI.

### Global client state → Redux Toolkit (narrow)

Allowed examples:

- Active `familyId` selection.
- Shell UI state that must persist across routes and is not server state (e.g., sidebar collapsed).

Forbidden examples:

- Caching API lists/entities that TanStack Query already owns.
- Form state (use React Hook Form).
- Derived server data.

See ADR-005.

---

## 5. Forms & validation

- React Hook Form for forms.
- Zod schemas from `packages/validation`.
- Map API errors (`error.details`) back to fields when present.
- Optimistic UI only when failure recovery is clear (MVP: prefer simple invalidation).

---

## 6. Authentication handling (frontend)

- Auth implemented against NestJS auth endpoints (ADR-003).
- Access token in memory + refresh via httpOnly cookie `ruma_refresh`.
- Local: `NEXT_PUBLIC_API_URL=http://localhost:4000/v1`.
- Production (Vercel): `NEXT_PUBLIC_API_URL=/v1` + `API_PROXY_TARGET=<railway origin>` so `/v1/*` is same-origin (rewrite in `next.config.ts`). Do not call Railway from the browser directly.
- App shell uses Next.js `Link` for nav (client transitions). Plain `<a>` full reloads drop the in-memory access token and feel like a forced re-login if refresh fails.
- On bootstrap: `POST /v1/auth/refresh`; on failure clear session and send authenticated routes to sign-in.
- Never store long-lived tokens in `localStorage`.

Route protection:

- Authenticated segment via server/layout checks + client guards as defense in depth.
- Family-required pages redirect to family create/select when none active.

---

## 7. Error & loading states

- Use consistent status patterns: skeleton/empty/error for family-scoped views.
- Errors should be calm and actionable, not technical stack dumps.
- Toast/inline errors sparingly; prefer contextual inline for forms.

---

## 8. Design system ownership

`packages/ui` owns:

- CSS variables / tokens (color, radius, spacing, elevation, typography)
- shadcn-based primitives restyled to RUMA
- documentation comments / Story-less usage guidelines in README for now

`apps/web` owns:

- page compositions
- feature-level organisms
- routing shell

### Token starter direction (from UI guidelines)

| Token            | Direction                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Surface          | Warm neutral / ivory `#F8F7F4`                                                                                                    |
| Ink              | Deep charcoal `#191919`                                                                                                           |
| Accent           | Muted sage `#6F806F`                                                                                                              |
| Secondary accent | Warm gold `#C6A66B` (sparse)                                                                                                      |
| Typography       | Plus Jakarta Sans / Manrope stack via CSS tokens (self-host or `next/font/local` later; avoid build-time Google Fonts dependency) |
| Radius           | Refined rounded, not pill-everything                                                                                              |
| Elevation        | Soft, restrained                                                                                                                  |
| Breakpoints      | Mobile-first; comfortable tablet/desktop dashboards                                                                               |

Bento layouts are for dashboard overview compositions, not every page.

---

## 9. Accessibility

- Semantic HTML first.
- Keyboard operable interactive elements.
- Sufficient contrast on ivory/sage surfaces.
- Visible focus states.
- Do not rely on color alone for status.

---

## 10. Responsive behavior

- Mobile-first layouts.
- Dashboard bento may simplify stacking on small screens.
- Touch targets adequate for household use on phones.
- Avoid horizontal clutter and dense admin-table vibes on mobile.

---

## 11. Phase 0–1 frontend scope (implemented)

- Next.js App Router shell with loading/error conventions
- Tailwind + RUMA tokens via `packages/ui`
- Primitives: Button, Input, Label, Card, Dialog, Nav, brand logos
- Design system demo at `/design-system`
- Auth pages: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password/[token]`
- Authenticated shell: `/app`, `/app/f/:familyId` home dashboard, tasks, grocery, calendar, members, settings; invites at `/invite/:token`
- Notification menu in shell (TanStack Query + light polling)
- Access token in memory; refresh via httpOnly cookie (same-origin `/v1` on Vercel)

Do **not** build finance/assets/AI UI yet.
