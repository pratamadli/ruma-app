# RUMA — Development Workflow

**Status:** Accepted for Phase 0

---

## 1. Prerequisites

- Node.js 22+ (CI pins a current LTS/Active version)
- pnpm 9+ (repo includes packageManager field)
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

## 4. Commit conventions

Use Conventional Commits lightly (not bureaucratic):

```text
feat: ...
fix: ...
docs: ...
chore: ...
refactor: ...
test: ...
```

No heavy commitlint gate in Phase 0 unless noise becomes a problem.

---

## 5. Git hooks

Phase 0 recommendation:

- **Husky + lint-staged** for Prettier/ESLint on staged files only.
- Keep hooks fast; do not run full build on commit.

If hooks become friction without value, remove them rather than bypass culture.

---

## 6. Environment setup

1. Copy env examples:
   - `apps/api/.env.example` → `apps/api/.env`
   - `apps/web/.env.example` → `apps/web/.env.local`
2. Start local PostgreSQL 16 (e.g. Homebrew `postgresql@16`).
3. Apply migrations: `pnpm --filter @ruma/api exec prisma migrate deploy`
4. Run `pnpm dev`.
5. Hit `GET /v1/health` and open http://localhost:3000.

---

## 7. Documentation workflow

Before meaningful implementation:

1. Read Vision / PRD / Architecture / relevant ADR.
2. Impact analysis.
3. Update docs when decisions change.

Definition of Done includes docs when behavior/architecture/schema changes (`docs/09_DOCUMENTATION_GOVERNANCE.md`).

---

## 8. CI/CD

### Pull request pipeline

```text
Install → Typecheck → Lint → Test → Build
```

### Deployment (initial)

- Web → Vercel (on main or explicit promote).
- API + production Postgres → Railway (on main or explicit promote).
- No Docker in this repo for app or local DB; see `docs/DEPLOYMENT.md`.
- Do not build complex multi-stage deploy orchestration in Phase 0.

---

## 9. Observability in development

- Pretty logs locally; structured logs in production.
- Sentry disabled unless `SENTRY_DSN` present.
- PostHog deferred until MVP usage needs product analytics.

---

## 10. Agent / Cursor workflow

Follow `.cursor/rules`:

- Read Project Brain before coding.
- Do not silently violate architecture.
- Prefer documentation updates with architectural changes.
