# RUMA - Deployment

Deploy order: **Neon Postgres -> Railway API -> Vercel Web**.

The selected deployment uses Railway and Neon Free, with Hermes running on the
operator's PC. No Docker is required. Render Free remains an alternative, but
the initial Render account verification blocked provisioning.
Do not delete or migrate an old database without separately approving that work.

| Piece                     | Host                                     | Configuration                                                                           |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| PostgreSQL                | [Neon](https://console.neon.tech/)       | Secret `DATABASE_URL` in the API service                                                |
| Nest API                  | [Railway](https://railway.com/dashboard) | [`railway.toml`](../railway.toml), [`nixpacks.toml`](../nixpacks.toml), repository root |
| Alternative Nest API      | [Render](https://dashboard.render.com/)  | [`render.yaml`](../render.yaml), repository root                                        |
| Next.js web               | [Vercel](https://vercel.com/)            | [`apps/web/vercel.json`](../apps/web/vercel.json)                                       |
| Hermes / Telegram Gateway | Local PC                                 | [Finance automation setup](./modules/finance/AUTOMATION.md)                             |

## Free-tier constraints

- Railway is usage-metered. Its published Free plan includes US$1/month of
  usage, and eligible trials include US$5 once for 30 days. Do not assume a new
  account grants eligibility or unlimited free hosting. Monitor usage and do
  not upgrade to a paid plan without approval.
- Render Free sleeps after 15 minutes without inbound traffic. Waking can take
  about a minute; a Telegram connection command may time out during that period.
  Wait for `/v1/health` to respond, check `/ruma status`, then retry if not linked.
  Do not use artificial keep-alive traffic to bypass the free-tier limits.
- Keep `FINANCE_JOBS_ENABLED=false`. In-process scheduled reminders/reports are
  not reliable on a service that sleeps.
- Leave `FINANCE_RECEIPT_DIR` **unset**. Uploads then return the explicit
  `RECEIPT_STORAGE_UNAVAILABLE` error instead of accepting files that disappear.
  Do not point it at `/tmp` or another ephemeral directory. Enable receipts only
  after provisioning durable private storage and validating its implementation.
- Do not create Render Free Postgres: it expires after 30 days. Neon Free is
  quota-limited but is not a time-limited trial. Monitor its compute/storage
  quotas and export backups; a free plan is not a production availability SLA.
- Manual finance, draft review and household Telegram linking remain available.
  The connection-only Hermes plugin does not add natural-language finance tools.

See [Render Free limits](https://render.com/docs/free) and
[Neon pricing](https://neon.com/pricing) for current limits.

## 1. Publish the selected revision

Production deployments use `main`; development integration uses `dev`. The user
approved promoting the finance feature into both branches for production.
Configure Railway's source branch and Vercel's production branch as `main`.
The alternative Render Blueprint also selects `main`, with auto-deploy off.

Pushing `main` can trigger production deployments. Database migrations affect
a shared database regardless of which Git branch initiated them; never point
unreviewed previews at a production database.

## 2. Create the Neon database

1. Create a **new project** on the Free plan, named `ruma`.
   If the current organization is Vercel-managed and **New project** is disabled,
   switch to a personal Neon organization or create the database through Vercel
   Storage. Do not reuse another application's database.
2. Prefer AWS Singapore (`ap-southeast-1`) alongside the API's Singapore region.
3. Use PostgreSQL 16, the project's recommended production major version.
4. Use the project's normal Postgres database/role; do not enable Neon Auth or
   replace the Nest session model.
5. Open **Connect**, select the new database and disable connection pooling.
   Copy the direct Postgres connection string straight into the API service's secret
   field. Never put it in Git, screenshots, build commands or chat.
6. Preserve TLS parameters from Neon (`sslmode=require`, and channel binding if
   provided). Add `connection_limit=5&connect_timeout=30` to its query string.

For this single-instance trial, the same direct `DATABASE_URL` is used by Prisma
at runtime and for migrations. This avoids running Prisma migration locks
through a transaction pooler. A future pooled setup should introduce a separate
direct migration URL and validate it before scaling.

## 3. Deploy the API

### Railway (selected)

1. Create a GitHub-backed API service from `pratamadli/ruma-app`.
2. Set **Settings -> Source -> Branch** to `main`.
3. Leave **Root Directory** empty so the repository-root Railway configuration
   and pnpm workspace apply.
4. Populate **Variables** with the shared API environment below. Keep Neon as
   the database; do not create a second Postgres service just for this setup.
5. Apply changes and deploy. `railway.toml` builds only the API and its workspace
   dependencies. Its pre-deploy command runs `prisma migrate deploy`; its start
   command runs the compiled Nest API.
6. After a successful deploy, use **Settings -> Networking -> Generate Domain**.
   Select the port detected from the API, which listens on Railway's `PORT`.
7. Verify API health and database readiness before updating Vercel.

Do not copy Render's `start:prod` override onto this service: Railway already
runs migrations in its separate pre-deploy command. Keep the checked-in commands
unless a deployment error establishes that they need changing.

### Render alternative: Blueprint

Render may require card verification even for a Free service. Complete that
directly in the provider dashboard if acceptable; do not send card details to
the assistant. If verification is blocked, stop provisioning rather than
claiming the service is deployed.

1. Connect GitHub with access to **only the required repository**.
2. Create a Blueprint from `pratamadli/ruma-app`, branch
   `main`, using the root `render.yaml`.
3. Verify the proposed service is **Free**, in Singapore, with no Render
   database, disk or paid worker.
4. Supply the new Neon connection string for `DATABASE_URL`.
5. Apply the Blueprint. Render generates the JWT secrets and the dedicated
   Hermes service token; keep them in provider secret management.

### Render alternative: manual Web Service settings

| Setting        | Value                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Runtime        | Node                                                                                                                            |
| Root directory | Empty (repository root), **not** `apps/api`                                                                                     |
| Branch         | `main`                                                                                                                          |
| Instance       | Free                                                                                                                            |
| Region         | Singapore                                                                                                                       |
| Build command  | `npx --yes pnpm@10.33.4 install --frozen-lockfile --prod=false && npx --yes pnpm@10.33.4 turbo run build --filter=@ruma/api...` |
| Start command  | `npx --yes pnpm@10.33.4 --filter @ruma/api start:prod`                                                                          |
| Health check   | `/v1/health`                                                                                                                    |
| Auto-deploy    | Off for the initial trial                                                                                                       |

Use Node 22 and pnpm 10.33.4. Keep build dependencies installed even with
`NODE_ENV=production`; Nest and Prisma need them during compilation.

The existing `start:prod` script runs `prisma migrate deploy && node dist/main.js`.
Migrations therefore finish successfully **before** the API binds its port.
Do not move migrations into the build command or use `prisma db push`.
Render Free has no pre-deploy command; paid services can later separate this
step. The API listens on `0.0.0.0` and Render's supplied `PORT`.

### Shared API environment

| Variable                            | Value                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `NIXPACKS_NODE_VERSION`             | `22` for Railway; also set in `nixpacks.toml`                                             |
| `NODE_VERSION`                      | `22` for the Render alternative                                                           |
| `NODE_ENV`                          | `production`                                                                              |
| `DATABASE_URL`                      | New Neon direct TLS connection string                                                     |
| `JWT_ACCESS_SECRET`                 | Independently generated secret, at least 32 characters                                    |
| `JWT_REFRESH_SECRET`                | Another independently generated secret, at least 32 characters                            |
| `HERMES_SERVICE_TOKEN`              | Dedicated secret; match it in the local Hermes profile only when activating the connector |
| `CORS_ORIGINS`                      | `https://ruma-app-web.vercel.app`                                                         |
| `APP_URL`                           | `https://ruma-app-web.vercel.app`                                                         |
| `FINANCE_JOBS_ENABLED`              | `false`                                                                                   |
| `FINANCE_RECEIPT_DIR`               | **Unset**                                                                                 |
| `EMAIL_FROM`                        | Optional; defaults to `RUMA <onboarding@resend.dev>`                                      |
| `RESEND_API_KEY`                    | Optional; required for actual invitation/password reset email delivery                    |
| `TELEGRAM_BOT_USERNAME`             | Optional bot username, without `@`                                                        |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | Optional observability                                                                    |

Do not configure a RUMA Telegram webhook for a bot already owned by Hermes
Gateway, and do not run a second poller for that bot.

### API smoke checks

- The generated Railway domain (or Render alternative) responds successfully at `/v1/health`.
- `/v1/health/ready` reports `database: "up"`.
- Deploy logs show all 15 migrations applied/up to date, then API startup.
- Use `/v1/health`, not the database readiness endpoint, for frequent platform
  health checks so checks do not unnecessarily keep Neon compute awake.

## 4. Connect Vercel

Keep the frontend's root directory at `apps/web`.

| Variable                         | Value                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `/v1`                                                                         |
| `API_PROXY_TARGET`               | Verified `https://<railway-service>.up.railway.app` origin, **without** `/v1` |
| `NEXT_PUBLIC_SENTRY_DSN`         | Optional public DSN                                                           |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional                                                                      |
| `NEXT_PUBLIC_APP_VERSION`        | Optional; defaults to the web package version                                 |

Update the Production environment and **redeploy `main`**: the rewrite is
evaluated when Next.js builds. Set **Settings -> Environments -> Production ->
Branch Tracking** to `main`. A Git merge does not replace an old API origin in
Vercel's environment variables. The Render alternative uses its verified
`onrender.com` origin instead.

The browser must call same-origin `/v1` on Vercel. Calling the API directly from
the browser can break refresh cookies. The existing rewrite forwards API
requests to `API_PROXY_TARGET`.

For an additional Vercel preview origin, explicitly add that exact origin to
API `CORS_ORIGINS`. Do not allow arbitrary `*.vercel.app` origins. Keep `APP_URL`
pointed at the intended user-facing site for invitation links.

## 5. End-to-end checks

- [ ] API health and database readiness succeed.
- [ ] Vercel `/v1/health` reaches the new API.
- [ ] Sign up/sign in, navigate to Family, and hard-refresh without losing the session.
- [ ] Create a test household and a manual finance transaction.
- [ ] Receipt uploads fail explicitly while storage is unconfigured.
- [ ] Jobs remain disabled; no new Telegram webhook/poller is configured.
- [ ] Activate the local connector separately following [automation setup](./modules/finance/AUTOMATION.md).

## Auto-deploy

Choose **one** mechanism, not both:

1. Native GitHub deployment on Railway and Vercel, both tracking `main`.
   Enable Railway's wait-for-CI setting when available; the repository runs CI
   for pushes to `main`.
2. The optional [CD workflow](../.github/workflows/cd.yml), triggered after
   successful `main` CI, using GitHub secrets `RAILWAY_DEPLOY_HOOK_URL` and
   `VERCEL_DEPLOY_HOOK_URL`. Disable native auto-deploy when using hooks.

Missing hook secrets are skipped. Never commit hook URLs. If using hooks, replace
any old-account Railway hook with the new service's hook before enabling this
path; otherwise remove the old secret and use native Git integration. The
abandoned `RENDER_DEPLOY_HOOK_URL` is no longer used.

## Session and data safety

- Nest owns authentication, not Neon Auth.
- Access JWTs live in browser memory; refresh tokens use an httpOnly
  `ruma_refresh` cookie scoped to `/v1/auth`.
- Production sets `Secure` and `SameSite=None`; the Vercel rewrite keeps browser
  requests first-party.
- The new Neon database starts empty. Existing accounts and households will not
  appear unless a separately approved data migration is performed.
- Keep database credentials, service tokens and local Hermes model credentials
  out of the browser frontend and Git.
- Do not delete old Railway/local database files as part of this setup.
