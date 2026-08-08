# RUMA — Production deployment

Deploy order: **Postgres → API → Web**. No Docker.

| Piece      | Host                                    | Config in repo                   |
| ---------- | --------------------------------------- | -------------------------------- |
| PostgreSQL | [Neon](https://neon.tech) (or Supabase) | —                                |
| `apps/api` | [Railway](https://railway.app)          | `railway.toml` (Nixpacks / pnpm) |
| `apps/web` | [Vercel](https://vercel.com)            | `apps/web/vercel.json`           |

---

## Checklist

### A. Push code

Commit and push deploy prep to `main` before connecting hosts to GitHub.

### B. Database (Neon — ~2 min)

1. Create project at [neon.tech](https://console.neon.tech).
2. Copy the connection string (use the one with `sslmode=require`).
3. Keep it for the API env as `DATABASE_URL`.

Migrations run automatically on API start (`prisma migrate deploy` in `start:prod`).

### C. API (Railway — ~5 min)

1. New project → **Deploy from GitHub** → `pratamadli/ruma-app`.
2. Root directory: **repository root** (so pnpm workspace + `railway.toml` apply).
3. Variables:

| Variable             | Example / notes                                   |
| -------------------- | ------------------------------------------------- |
| `NODE_ENV`           | `production`                                      |
| `DATABASE_URL`       | Neon URL                                          |
| `JWT_ACCESS_SECRET`  | `openssl rand -base64 48`                         |
| `JWT_REFRESH_SECRET` | another `openssl rand -base64 48`                 |
| `CORS_ORIGINS`       | leave placeholder, update after Vercel URL exists |
| `APP_URL`            | leave placeholder, update after Vercel            |
| `EMAIL_FROM`         | `RUMA <onboarding@resend.dev>`                    |
| `RESEND_API_KEY`     | optional                                          |

4. Generate a public domain (Railway → Settings → Networking → Generate domain).
5. Smoke: `https://<api>.up.railway.app/v1/health`

### D. Web (Vercel — ~5 min)

1. [vercel.com/new](https://vercel.com/new) → import `pratamadli/ruma-app`.
2. **Root Directory:** `apps/web` (Important).
3. Env:

| Variable              | Value                             |
| --------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://<api>.up.railway.app/v1` |

4. Deploy → copy production URL (e.g. `https://ruma-xxx.vercel.app`).

### E. Wire origins

On Railway, set and redeploy:

| Variable       | Value                         |
| -------------- | ----------------------------- |
| `CORS_ORIGINS` | `https://ruma-xxx.vercel.app` |
| `APP_URL`      | `https://ruma-xxx.vercel.app` |

### F. Smoke

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

- Do not deploy Nest as a Vercel serverless function (not configured).
- Do not leave `NEXT_PUBLIC_API_URL` as localhost on Vercel.
- Do not forget to update `CORS_ORIGINS` after the first Vercel URL.
