# RUMA — Production deployment

Deploy order: **Postgres → API → Web**.

No Docker in this repo. Local Postgres is a native install (e.g. Homebrew). Production uses managed Postgres on Railway.

**Node / pnpm:** production uses **Node 22** + **pnpm 10.33.4** via `npx` (see `.nvmrc`, `nixpacks.toml`, `packageManager`). Do not rely on Corepack on Railway — pnpm 11 crashes (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`), and global `pnpm` is often missing from PATH across Nixpacks layers.

| Piece      | Host                                          | Config in repo                                                  |
| ---------- | --------------------------------------------- | --------------------------------------------------------------- |
| PostgreSQL | [Railway](https://railway.app) Postgres       | —                                                               |
| `apps/api` | [Railway](https://railway.app) (same project) | `railway.toml`, `nixpacks.toml`                                 |
| `apps/web` | [Vercel](https://vercel.com)                  | `apps/web/vercel.json`, `apps/web/next.config.ts` (API rewrite) |

Current production (reference):

| Surface | URL                                          |
| ------- | -------------------------------------------- |
| Web     | `https://ruma-app-web.vercel.app`            |
| API     | `https://ruma-app-production.up.railway.app` |

---

## Checklist

### A. Push code

Commit and push to `main` before connecting hosts to GitHub (or after config changes).

### B. Database + API (Railway)

1. Create a project at [railway.app](https://railway.app) → **Deploy from GitHub** → `pratamadli/ruma-app`.
2. Root directory: **repository root** (so pnpm workspace + `railway.toml` apply). Do **not** set root to `apps/api`.
3. Same project: **New** → **Database** → **PostgreSQL**.
4. On the **API service**, Variables:

| Variable                     | Value / notes                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | `production`                                                                            |
| `DATABASE_URL`               | Variable **reference** to Postgres → `DATABASE_URL` (internal host is fine for the API) |
| `JWT_ACCESS_SECRET`          | `openssl rand -base64 48`                                                               |
| `JWT_REFRESH_SECRET`         | another `openssl rand -base64 48`                                                       |
| `CORS_ORIGINS`               | Vercel web origin, e.g. `https://ruma-app-web.vercel.app`                               |
| `APP_URL`                    | Same as web origin (invite links)                                                       |
| `EMAIL_FROM`                 | `RUMA <onboarding@resend.dev>`                                                          |
| `RESEND_API_KEY`             | optional (invites + password reset emails)                                              |
| `PASSWORD_RESET_TTL_SECONDS` | optional (default `3600`)                                                               |
| `SENTRY_DSN`                 | optional API error tracking                                                             |
| `SENTRY_ENVIRONMENT`         | optional (defaults to `NODE_ENV`)                                                       |
| `NIXPACKS_NODE_VERSION`      | `22` (optional belt-and-suspenders)                                                     |

5. **Settings → Networking → Generate Domain**. Target port = Railway `PORT` (often **8080**).
6. Smoke:
   - `https://<api>.up.railway.app/v1/health`
   - `https://<api>.up.railway.app/v1/health/ready` → `database: "up"`

Migrations run via Railway `preDeployCommand` (`prisma migrate deploy`) before each deploy (`railway.toml`).

### C. Web (Vercel)

1. [vercel.com/new](https://vercel.com/new) → import `pratamadli/ruma-app`.
2. **Root Directory:** `apps/web`.
3. Env (required for auth cookies):

| Variable                         | Value                                                |
| -------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `/v1`                                                |
| `API_PROXY_TARGET`               | `https://<api>.up.railway.app` (**no** `/v1` suffix) |
| `NEXT_PUBLIC_SENTRY_DSN`         | optional public DSN                                  |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | optional (e.g. `production`)                         |

`API_PROXY_TARGET` enables a Next.js rewrite (`/v1/*` → Railway) in `apps/web/next.config.ts`. The browser must call **same-origin** `/v1` on Vercel. Calling Railway from the browser directly breaks refresh cookies (third-party cookie) so Family/nav reloads look like “logged out”.

4. Deploy → note production URL.

### D. Wire origins

On Railway API, ensure and redeploy if needed:

| Variable       | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| `CORS_ORIGINS` | `https://ruma-app-web.vercel.app` (plus custom domains later) |
| `APP_URL`      | same                                                          |

### E. Smoke

- [ ] Landing loads on Vercel
- [ ] Sign up / sign in
- [ ] Open **Family** tab without being sent to sign-in
- [ ] Hard refresh → still signed in
- [ ] Create family / members / settings
- [ ] Invite (URL in API logs if Resend unset)

---

## Auto-deploy on push to `main`

Two options. Pick **one** to avoid double deploys.

### Option A — Native GitHub sync (simplest)

**Railway (`ruma-app` service)**

1. **Settings** → **Source**
2. Repo `pratamadli/ruma-app`, branch **`main`**
3. Auto deploy / deploy on push: **ON**
4. Recommended: **Wait for CI** = ON (waits for GitHub Action `CI`)

**Vercel (`ruma-app-web`)**

1. **Settings** → **Git**
2. Connected to `pratamadli/ruma-app`
3. **Production Branch** = `main`
4. Automatic deployments from Git: **ON**

### Option B — CD workflow after CI (deploy hooks)

Repo workflow: `.github/workflows/cd.yml`  
Flow: push `main` → `CI` green → curl deploy hooks → Railway + Vercel.

1. Railway → deploy hook URL (turn **off** Git auto-deploy if using hooks only).
2. Vercel → Deploy Hook for `main` (optional: disable automatic Git deploys).
3. GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Secret                    | Value                   |
| ------------------------- | ----------------------- |
| `RAILWAY_DEPLOY_HOOK_URL` | Railway deploy hook URL |
| `VERCEL_DEPLOY_HOOK_URL`  | Vercel deploy hook URL  |

Missing secrets are skipped (workflow still succeeds).

---

## Auth session model (production)

| Piece                   | Behavior                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Access token            | JWT in browser memory; `Authorization: Bearer`                                                                   |
| Refresh token           | httpOnly cookie `ruma_refresh`, path `/v1/auth`                                                                  |
| Local                   | `SameSite=Lax`, API at `localhost`                                                                               |
| Production cookie flags | `Secure` + `SameSite=None` (set by API when `NODE_ENV=production`)                                               |
| Production browser path | Web uses `NEXT_PUBLIC_API_URL=/v1` so cookie is **first-party on Vercel** via rewrite                            |
| App shell nav           | Next.js `Link` (client navigation); avoid full document reloads that drop in-memory access tokens before refresh |

Do **not** set `NEXT_PUBLIC_API_URL` to the raw Railway URL on Vercel.

---

## Inspecting production data

Railway’s in-dashboard DB browser sometimes fails (SSH/WebSocket tunnel). That does **not** mean Postgres is down if `/v1/health/ready` is green.

Options:

1. Postgres → **Console** → SQL (`\dt`, `SELECT …`).
2. Local Prisma Studio with the **public** Railway `DATABASE_URL` (host `*.railway.app` / proxy — not `*.railway.internal`):

```bash
cd apps/api
DATABASE_URL="postgresql://..." pnpm exec prisma studio
```

3. TablePlus / DBeaver with the public TCP credentials from Railway **Connect**.

---

## Local secret generation

```bash
openssl rand -base64 48
openssl rand -base64 48
```

---

## What not to do

- Do not add Dockerfiles or docker-compose for app/runtime in this repo.
- Do not deploy Nest as a Vercel serverless function (not configured).
- Do not point Vercel `NEXT_PUBLIC_API_URL` at Railway (use `/v1` + `API_PROXY_TARGET`).
- Do not forget `CORS_ORIGINS` / `APP_URL` after the web URL is known.
- Do not use Neon/Supabase Auth as the session authority (Nest owns auth; see ADR-003).
