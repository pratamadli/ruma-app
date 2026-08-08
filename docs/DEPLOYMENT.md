# RUMA — Production deployment

Deploy order: **Postgres → API → Web**.

No Docker in this repo. Local Postgres is a native install (e.g. Homebrew). Production uses managed Postgres on Railway.

**Node / pnpm:** production uses **Node 22** + **pnpm 10.33.4** via `npx` (see `.nvmrc`, `nixpacks.toml`, `packageManager`). Do not rely on Corepack on Railway — pnpm 11 crashes (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`), and global `pnpm` is often missing from PATH across Nixpacks layers.

| Piece      | Host                                           | Config in repo                   |
| ---------- | ---------------------------------------------- | -------------------------------- |
| PostgreSQL | [Railway](https://railway.app) Postgres plugin | —                                |
| `apps/api` | [Railway](https://railway.app) (same project)  | `railway.toml` (Nixpacks / pnpm) |
| `apps/web` | [Vercel](https://vercel.com)                   | `apps/web/vercel.json`           |

---

## Checklist

### A. Push code

Commit and push deploy prep to `main` before connecting hosts to GitHub.

### B. Database + API (Railway — ~10 min)

1. Create a project at [railway.app](https://railway.app) → **Deploy from GitHub** → `pratamadli/ruma-app`.
2. Root directory: **repository root** (so pnpm workspace + `railway.toml` apply).
3. In the same project: **New** → **Database** → **Add PostgreSQL**.
4. On the **API service**, Variables → add / reference:

| Variable             | Value / notes                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                                                                                                                      |
| `DATABASE_URL`       | From Postgres plugin → **Connect** / variable reference `${{Postgres.DATABASE_URL}}` (Railway UI may use the plugin service name) |
| `JWT_ACCESS_SECRET`  | `openssl rand -base64 48`                                                                                                         |
| `JWT_REFRESH_SECRET` | another `openssl rand -base64 48`                                                                                                 |
| `CORS_ORIGINS`       | placeholder until Vercel URL exists (e.g. `https://example.com`)                                                                  |
| `APP_URL`            | same placeholder                                                                                                                  |
| `EMAIL_FROM`         | `RUMA <onboarding@resend.dev>`                                                                                                    |
| `RESEND_API_KEY`     | optional                                                                                                                          |

5. Generate a public domain for the API (Settings → Networking → Generate domain).
6. Smoke: `https://<api>.up.railway.app/v1/health`

Migrations run on API start (`prisma migrate deploy` in `start:prod`).

### C. Web (Vercel — ~5 min)

1. [vercel.com/new](https://vercel.com/new) → import `pratamadli/ruma-app`.
2. **Root Directory:** `apps/web`.
3. Env:

| Variable              | Value                             |
| --------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://<api>.up.railway.app/v1` |

4. Deploy → copy production URL (e.g. `https://ruma-xxx.vercel.app`).

### D. Wire origins

On the Railway API service, set and redeploy:

| Variable       | Value                         |
| -------------- | ----------------------------- |
| `CORS_ORIGINS` | `https://ruma-xxx.vercel.app` |
| `APP_URL`      | `https://ruma-xxx.vercel.app` |

### E. Smoke

- [ ] Landing loads on Vercel
- [ ] Sign up / sign in
- [ ] Hard refresh → still signed in
- [ ] Create family
- [ ] Invite (URL in API logs if Resend unset)

---

## Local secret generation

```bash
openssl rand -base64 48
openssl rand -base64 48
```

---

## Auth cookie note

Production refresh cookie uses `SameSite=None; Secure` so credentialed requests from Vercel → Railway still send `ruma_refresh`.

---

## What not to do

- Do not add Dockerfiles or docker-compose for app/runtime in this repo.
- Do not deploy Nest as a Vercel serverless function (not configured).
- Do not leave `NEXT_PUBLIC_API_URL` as localhost on Vercel.
- Do not forget to update `CORS_ORIGINS` after the first Vercel URL.
