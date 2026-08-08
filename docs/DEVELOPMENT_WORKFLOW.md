# RUMA — Development Workflow

**Status:** Accepted through Phase 0/1

---

## 1. Prerequisites

- Node.js 22.x (CI and Railway pin 22; see `.nvmrc`)
- pnpm 10.33.4 (`packageManager` field; avoid pnpm 11 on Railway)
- PostgreSQL 16+ (local install; no Docker)

---

## 2. Repository scripts (root)

| Command             | Purpose                     |
| ------------------- | --------------------------- |
| `pnpm install`      | Install workspace deps      |
| `pnpm dev`          | Run web + api via Turborepo |
| `pnpm build`        | Build all packages/apps     |
| `pnpm lint`         | Lint all targets            |
| `pnpm typecheck`    | TypeScript checks           |
| `pnpm test`         | Run unit/integration tests  |
| `pnpm format`       | Prettier write              |
| `pnpm format:check` | Prettier check              |

App-scoped:

- `pnpm --filter @ruma/api dev`
- `pnpm --filter @ruma/web dev`

---

## 3. Branching & PRs

- `main` is protected by CI.
- Feature branches from `main`.
- PRs require CI pass: install → typecheck → lint → test → build.
- Keep PRs small and documentation-updated when decisions change.

---

## 4. Product versioning

**Source of truth:** `package.json` `version` fields (semver).

| Package       | Path                    | Role                              |
| ------------- | ----------------------- | --------------------------------- |
| `ruma` (root) | `/package.json`         | Canonical product release         |
| `@ruma/web`   | `apps/web/package.json` | Shown in the UI footer            |
| `@ruma/api`   | `apps/api/package.json` | Keep in sync with product release |

Current release: **`1.1.0`** (Phase 0 foundation + Phase 1 household MVP + hardening).

### How the UI gets the version

1. Bump `version` in root, `apps/web`, and `apps/api` together.
2. `apps/web/next.config.ts` injects `apps/web/package.json` → `NEXT_PUBLIC_APP_VERSION`.
3. UI reads `APP_VERSION` from `apps/web/src/lib/version.ts` (home footer + app shell).

Optional override for a deploy: set `NEXT_PUBLIC_APP_VERSION` in Vercel (normally unnecessary).

Do **not** hardcode a different version in components. Shared packages under `packages/*` may remain independently versioned (`0.0.0` private) until published.

---

## 5. Commit conventions

Use Conventional Commits lightly (not bureaucratic):

```text
feat: ...
fix: ...
docs: ...
chore: ...
refactor: ...
test: ...
```

No heavy commitlint gate unless noise becomes a problem.

---

## 6. Git hooks

Phase 0 recommendation:

- **Husky + lint-staged** for Prettier/ESLint on staged files only.
- Keep hooks fast; do not run full build on commit.

If hooks become friction without value, remove them rather than bypass culture.

---

## 7. Environment setup

1. Copy env examples:
   - `apps/api/.env.example` → `apps/api/.env`
   - `apps/web/.env.example` → `apps/web/.env.local`
2. Start local PostgreSQL 16 (e.g. Homebrew `postgresql@16`).
3. Apply migrations: `pnpm --filter @ruma/api exec prisma migrate deploy`
4. Run `pnpm dev`.
5. Hit `GET /v1/health` and open http://localhost:3000.

---

## 8. Documentation workflow

Before meaningful implementation:

1. Read Vision / PRD / Architecture / relevant ADR.
2. Impact analysis.
3. Update docs when decisions change.

Definition of Done includes docs when behavior/architecture/schema changes (`docs/09_DOCUMENTATION_GOVERNANCE.md`).

---

## 9. CI/CD

### Pull request pipeline

```text
Install → Typecheck → Lint → Test → Build
```

### Deployment (initial)

- Web → Vercel; API + Postgres → Railway. See `docs/DEPLOYMENT.md`.
- Auto-deploy on `main`: native GitHub sync (recommended) and/or `.github/workflows/cd.yml` deploy hooks after CI.
- No Docker in this repo for app or local DB.

---

## 10. Observability in development

- Pretty logs locally; structured logs in production.
- Sentry disabled unless `SENTRY_DSN` present.
- PostHog deferred until MVP usage needs product analytics.

---

## 11. Agent / Cursor workflow

Follow `.cursor/rules`:

- Read Project Brain before coding.
- Do not silently violate architecture.
- Prefer documentation updates with architectural changes.
