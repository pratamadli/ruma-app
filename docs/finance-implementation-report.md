# Finance platform implementation report

## Outcome

Implemented specification phases 0-6 on `feat/finance-platform`, branched from
`dev`. With subsequent user approval, the implementation and Render/Neon
deployment configuration were committed as `2471133` and pushed to that feature
branch. No merge to `main` or PR was performed. The original implementation
guide remains preserved and untracked.

RUMA remains a Household OS: the implementation extends the existing Finance
module, Family aggregate, shared UI and ivory/charcoal/sage design. It does not
introduce a replacement ledger, a new household entity, microservices or
autonomous financial writes.

## Phase delivery and verification gates

| Phase | Delivered                                                                                                               | Verification                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Architecture audit, feature gaps, assumptions, risks and implementation sequence                                        | Existing finance, auth, UI, schema, tests and deployment inspected before implementation                                                                             |
| 1     | Explicit scope/ownership/payer, additive schema, domain validation, private audits, idempotent ledger writes            | Real PostgreSQL tests for same-household personal privacy, tenant isolation, first-day aggregation, transfers and idempotency; shared money validation tests         |
| 2     | Scope-aware accounts/dashboard/transactions, create/edit/void, date/payer filters and pagination                        | Web typecheck, lint, strict rupiah-input test and production build                                                                                                   |
| 3     | Scoped budgets, category ceilings, income/savings/investment allocations and manual goals                               | API tests for personal/shared coexistence, actual spending, remaining/unallocated amounts, privacy and unchanged transaction history                                 |
| 4     | One-time Telegram linking, dedicated service guards, Hermes tools, expiring drafts, correction and trusted confirmation | API tests for forged webhook rejection, single-use links, unlink revocation, expiry, concurrent confirmation and inability of Hermes to authorize writes             |
| 5     | Private validated receipt upload, OCR adapter/manual review, duplicates, correction and transaction attachments         | Image decoding/MIME/size tests; malformed provider JSON; no extraction-time ledger write; corrected confirmation invalidation; same-household private receipt denial |
| 6     | Manual holdings/valuations, exact trade quantities/prices/fees, scoped reminders and monthly Telegram reports           | Tests for buy/sell balances and fees, valuation/privacy, timezone boundaries, recipients, once-per-period delivery and uncertain-send suppression                    |

The phase-6 implementation was checked after phase-5 validation. Final
cross-cutting regression checks include the existing household, invitation,
authentication and email-import workflows.

## Important files

- [Plan](./finance-implementation-plan.md), [ADR-015](./adr/015-personal-household-finance.md),
  [changelog](../CHANGELOG.md).
- [Prisma schema](../apps/api/prisma/schema.prisma) and
  [migrations](../apps/api/prisma/migrations).
- [Finance service](../apps/api/src/finance/finance.service.ts),
  [access/audit helpers](../apps/api/src/finance/finance-access.ts),
  [budget service](../apps/api/src/finance/budget.service.ts),
  [goals](../apps/api/src/finance/goals.service.ts),
  [investments](../apps/api/src/finance/investments.service.ts).
- [Automation](../apps/api/src/finance/automation) and
  [receipt services](../apps/api/src/finance/receipts).
- [Finance web routes](../apps/web/src/app/app/f/[familyId]/finance),
  [scope controls](../apps/web/src/components/finance-scope.tsx),
  [receipt capture](../apps/web/src/components/receipt-capture.tsx),
  [typed API client](../apps/web/src/lib/api.ts).
- [Shared contracts](../packages/types/src/index.ts),
  [finance validation](../packages/validation/src/finance.ts),
  [automation validation](../packages/validation/src/finance-automation.ts).
- Existing [email imports](../apps/api/src/finance/imports/import.service.ts) and
  [intelligence](../apps/api/src/finance/intelligence/intelligence.service.ts)
  now preserve the personal/household boundary.
- [Module documentation](./modules/finance/README.md),
  [API](./modules/finance/API.md), [data model](./modules/finance/DATA_MODEL.md),
  [security](./modules/finance/SECURITY.md),
  [automation setup](./modules/finance/AUTOMATION.md), and
  [API environment example](../apps/api/.env.example).

## Household Telegram connection follow-up

The household dashboard and Finance > Capture now share a
[Connect to Telegram component](../apps/web/src/components/telegram-connect.tsx).
It issues a ten-minute, single-use code bound to the signed-in user and selected
household, displays their email and copyable `/ruma connect` command, and refreshes
after successful verification. No shared code can be used to impersonate another
household member by changing the email.

The backend checks email, code, membership and Telegram identity atomically.
Each sender has one active household; tools, draft buttons and scheduled delivery
are constrained to it. Switching requires a fresh dashboard code. Orphaned
connections can be revoked, while disconnecting an unrelated active household
cannot remove another connection.

The [native Hermes plugin](../integrations/hermes/ruma-connection) provides
private-chat connection/status/disconnect commands using verified transport
identity, without passing the code to the LLM or starting another bot poller.
Its four stdlib unit tests and the installed Hermes plugin compatibility validator
passed. API tests cover two households using the same bot, email impersonation,
replay/concurrent redemption, expiry, replacement, revoked membership, stale
callbacks and cross-household scheduled delivery.

The live Hermes profile was **not modified or restarted**. Activating the plugin
requires deployment of the API/migration, its verified API origin, matching
server-side credentials and an explicit plugin installation. The currently
documented Railway hostname returned `Application not found` during diagnostics.
Connection management alone does not install model-callable finance tools or a
trusted confirmation-callback bridge. See [setup and multi-tenant runtime
requirements](./modules/finance/AUTOMATION.md).

## Render/Neon trial preparation

The user selected a new empty Neon database, Render Free, and the existing
Vercel frontend, with receipt uploads and scheduled jobs disabled for the trial.
The [Render Blueprint](../render.yaml) and [deployment guide](./DEPLOYMENT.md)
use the existing migration-before-start script and preserve all old data.
The API/shared-package build and deployment-file formatting passed.

Cloud deployment is **not live**: Render requested card verification while
creating a Blueprint, and the user confirmed that verification remains blocked.
No Render service was created and Vercel's API proxy was not changed. Neon
provisioning also awaits access to the intended personal organization; the
shared dashboard still showed a Vercel-managed organization with project
creation disabled. Existing databases and the local Hermes runtime were not
modified. Provider-side Blueprint validation and cloud smoke checks are pending.

## Database deployment

Six additive migrations:

1. `20261115010000_finance_scope`
2. `20261115020000_finance_planning`
3. `20261115030000_finance_drafts_telegram`
4. `20261115040000_finance_receipts`
5. `20261115050000_finance_investments_schedules`
6. `20261115060000_telegram_household_link`

Existing data remains HOUSEHOLD; historical account owner labels do not silently
become privacy ownership. Partial unique indexes enforce household budget-month
and report-scope uniqueness. Preserve these migration-level constraints.

After backing up the target database and private receipt volume, set the API
environment for the intended deployment and run:

```powershell
pnpm.cmd --filter @ruma/api exec prisma migrate deploy
pnpm.cmd --filter @ruma/api exec prisma generate
pnpm.cmd --filter @ruma/types --filter @ruma/validation build
pnpm.cmd --filter @ruma/api --filter @ruma/web build
```

Do not point validation commands at production. Local validation used an
independent loopback-only PostgreSQL 13 cluster because that was the installed
native version; the project recommends PostgreSQL 16+. All 15 migrations,
including the original nine, deployed successfully. Schema validation and
migration status passed. No production migration was performed.

## Final checks

| Check                                                        | Result                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Prisma migrate deploy / generate / validate / migrate status | Passed; database up to date                                                                          |
| Shared types and validation builds                           | Passed                                                                                               |
| API full Vitest suite, real disposable PostgreSQL            | **36 tests passed**, 16 files; no database skips                                                     |
| Validation Vitest suite                                      | **6 tests passed**                                                                                   |
| Web Vitest suite                                             | **2 tests passed**                                                                                   |
| Native Hermes connection plugin                              | **4 tests passed**, plus native plugin compatibility validation                                      |
| API, web and validation lint                                 | Passed                                                                                               |
| API and web typecheck                                        | Passed                                                                                               |
| API production build                                         | Passed                                                                                               |
| Web production build, including all new finance routes       | Passed                                                                                               |
| Git whitespace check                                         | Passed                                                                                               |
| Local HTTP readiness                                         | API health and production web returned success                                                       |
| Browser smoke observation                                    | Sign-up and authenticated transaction UI rendered; automated browser mutation flow was not completed |

Commands:

```powershell
# Set DATABASE_URL to an isolated disposable database before API tests.
pnpm.cmd --filter @ruma/api exec vitest run --maxWorkers=1 --hookTimeout=60000 --testTimeout=60000
pnpm.cmd --filter @ruma/validation --filter @ruma/web test
pnpm.cmd --filter @ruma/api --filter @ruma/web --filter @ruma/validation lint
pnpm.cmd --filter @ruma/api --filter @ruma/web typecheck
pnpm.cmd --filter @ruma/api --filter @ruma/web build
```

Serial API execution avoids cold-start integration hook timeouts on this machine.
Tests retain their assertions. Formatting was restricted to implementation files.
The build retains two existing non-blocking Next.js warnings: an unrelated parent
lockfile affects workspace-root inference, and the Next ESLint plugin is absent.
Neither unrelated configuration was changed.

Browser automation was stopped when the shared page was being used interactively.
An isolated context was unavailable in the integrated browser. No claim is made
that a full browser E2E suite or responsive-device matrix passed; no E2E suite
previously existed. API integration tests verify the authoritative write/privacy
flows, while frontend typechecks and production builds verify compilation.

## Remaining manual setup and limits

- Configure a persistent private receipt directory and backup/retention policy.
  Images are normalized JPEGs, limited to PNG/JPEG uploads of 5 MB/16 million
  pixels. Database cascades do not remove files from persistent storage/backups.
- Configure Telegram bot/webhook secrets, deploy HTTPS, link users and verify
  private-chat callbacks. No live Telegram delivery was exercised.
- Hermes and OCR endpoints are documented custom adapter contracts, not assumed
  native provider APIs. Keep 9Router/model credentials in the Hermes runtime.
  Adapter behavior was tested with mocks; live Hermes/9Router/vision integration
  requires an operator smoke test. Missing OCR explicitly requests manual review.
- Receipt image upload is web-based; Telegram photo transport is not enabled.
  Confirmed attachments are downloadable from transaction editing/details.
- Enable `FINANCE_JOBS_ENABLED` only after validating recipients and bot setup.
  Keep an API instance awake. Delivery claims avoid repeated automatic attempts,
  but cannot guarantee exactly-once external delivery after an ambiguous timeout.
  FAILED/UNCERTAIN reconciliation and controlled requeue remain operational;
  there is no blind retry endpoint. Removed schedule creators are logged/skipped.
- Monthly schedules use days 1-28 and catch up within the current month only.
  Personal recipients are owner-only; shared recipients are active members.
- Investment positions/valuation snapshots and goal progress are manually
  maintained. Trades do not automatically change position quantities. Fees,
  transfers, buys/sells and valuations are not ordinary consumption expenses.
  No broker/bank sync, live prices, FX, tax or realized-gain calculation is added.
- New writes support IDR. Review any legacy non-IDR data before aggregating it.
- Scope is immutable. Personal resources still require active family membership.
  Categories remain shared taxonomy, not a private financial-value surface.

Recommended next step: operator acceptance testing on a staging PostgreSQL 16+
deployment with real Telegram/Hermes/OCR adapters, followed by an isolated browser
flow on desktop and mobile. Do not enable unattended jobs before that check.

Temporary API/web validation helpers were stopped after inspection. The local
test database is not a deployment database; its files are retained rather than
deleting any interactively entered data.
