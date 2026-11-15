# RUMA Finance --- Copilot Agent Implementation Guide

> **Purpose:** This document is the implementation brief for GitHub
> Copilot Agent. Read this file first, inspect the existing repository,
> then implement the RUMA Finance transformation incrementally.
>
> **Repository:** `pratamadli/ruma-app`
>
> **Product direction:** Evolve the existing RUMA application into a
> household finance platform with personal/shared finances and
> Telegram-based automation powered by Hermes Agent and an LLM routed
> through 9Router.

---

## 0. Instructions to Copilot Agent

You are acting as a senior full-stack engineer working in an existing
production-minded codebase.

### Mandatory working rules

1.  **Inspect before changing.** Read the repository structure,
    `README`, package manifests, environment examples, database schema,
    migrations, authentication, API conventions, UI patterns, tests, and
    deployment configuration.
2.  **Do not assume the stack.** Derive the actual framework, package
    manager, ORM, database, auth mechanism, and deployment setup from
    the repository. Do not replace working technologies just because
    another stack is familiar.
3.  **Do not rewrite the application from scratch.** Preserve existing
    features and conventions unless there is a clear technical reason to
    change them.
4.  **Create an implementation plan first.** Summarize:
    - current architecture and reusable modules;
    - gaps against this document;
    - proposed schema/API/UI changes;
    - migration and backward-compatibility risks;
    - implementation phases and files likely to change.
5.  After the plan, proceed with implementation in small, reviewable
    increments. If the environment requires explicit approval before
    edits, ask for it. Otherwise start with the first safe phase.
6.  Keep the application runnable after each phase. Run relevant lint,
    type-check, tests, and build commands; fix regressions introduced by
    your changes.
7.  Use the existing package manager and established code style. Do not
    introduce duplicate libraries or unnecessary dependencies.
8.  Never commit secrets, real credentials, bot tokens, API keys,
    private keys, or production data. Update `.env.example` with
    variable names and safe placeholders only.
9.  Do not fabricate successful integrations. If Telegram, Hermes,
    9Router, OCR, or an external provider cannot be reached locally,
    implement a testable adapter/mock and document the remaining setup.
10. Do not silently make destructive database changes. Use additive
    migrations where possible, preserve existing data, and explain any
    unavoidable migration or backfill.
11. Keep business logic in the RUMA backend. The AI agent must not
    connect directly to PostgreSQL or bypass application authorization.
12. When a requirement is ambiguous, choose the safest minimal
    implementation, document the assumption, and continue where
    possible. Ask only when a decision blocks safe implementation.

### Expected deliverables

- Working code integrated into the existing RUMA repository.
- Database schema and migrations.
- Validated backend services and API endpoints.
- Web UI for core finance workflows.
- Automated tests for business rules, permissions, and critical flows.
- Telegram/Hermes integration boundary and setup documentation.
- Updated `.env.example` and developer documentation.
- A concise implementation report listing completed work, tests run,
  known limitations, and manual setup still required.

---

## 1. Product vision

RUMA Finance is a module inside the existing RUMA application. It helps
two household members manage:

- personal income and expenses;
- shared household income and expenses;
- accounts and wallets;
- monthly budgets and financial plans;
- financial goals;
- investment contributions and portfolio tracking;
- transaction capture through the web app and Telegram;
- receipt extraction using OCR/AI;
- reminders and scheduled monthly reports.

The product must support two household members initially but should not
hard-code the system to exactly two users.

### Core product principles

- **One source of truth:** RUMA backend and database own all financial
  records.
- **AI assists, users decide:** AI can interpret, extract, classify,
  and prepare drafts. Financial records are only committed after user
  confirmation.
- **Personal privacy:** Personal records are visible only to their
  owner unless explicitly shared.
- **Household transparency:** Household/shared records are visible to
  authorized household members.
- **Auditable changes:** Financial records and important automation
  actions should be traceable.
- **No double counting:** Transfers and investment movements must not
  be treated as ordinary income or consumption expenses.

---

## 2. First task: repository audit

Before implementation, inspect and report:

### Application architecture

- Frontend framework, routing, component system, styling, state
  management.
- Backend framework, module structure, API conventions, validation
  strategy.
- Database engine, ORM, current schema, migration strategy.
- Authentication and authorization implementation.
- Existing household, user, membership, notification, or scheduling
  functionality.
- Existing tests, lint, type-check, and build scripts.
- Hosting/deployment and file/object storage configuration.

### Existing functionality

Identify what can be reused for: - users and authentication; -
household/workspace membership; - roles and permissions; - dashboard and
navigation; - notifications; - scheduled/background jobs; - file
uploads; - settings and preferences.

### Audit output

Create `docs/finance-implementation-plan.md` containing: - current
architecture summary; - feature gap analysis; - proposed implementation
sequence; - database/API/UI impact; - migration and security risks; -
unresolved assumptions.

Do not duplicate existing entities or features. Extend them where
appropriate.

---

## 3. Domain model and business rules

Adapt these concepts to the repository's existing schema and naming
conventions. They are conceptual requirements, not a mandate to create
every table with these exact names.

### 3.1 Household and membership

A user can belong to a household. A household can have multiple members.

Required concepts: - Household - HouseholdMembership - membership
role/permissions - active household context

Authorization rules: - A user can access only their own personal records
and records belonging to households where they are an authorized
member. - A household member can access household-shared records
according to membership permissions. - One member must not be able to
read another member's personal records by changing an ID in a request. -
Never trust a `userId`, `householdId`, or `ownerId` supplied by the
client without checking it against the authenticated principal and
membership.

### 3.2 Personal versus household scope

Every financial record that supports ownership must have a clear scope:

- `PERSONAL`: belongs to one user and is private by default.
- `HOUSEHOLD`: belongs to the active household and is visible to
  authorized household members.

Do not infer scope from the payer. The person who paid, the person who
owns a transaction, and the scope of the transaction are different
concepts.

For an expense, support where relevant: - payer/user who paid; - scope
(`PERSONAL` or `HOUSEHOLD`); - account used; - category; - amount and
currency; - transaction date; - description/merchant; - optional notes
and receipt; - optional split/allocation between people or categories.

For an income, support: - recipient; - scope; - destination account; -
income category; - amount and date.

### 3.3 Accounts and categories

Accounts represent cash or financial accounts such as: - cash; - bank
accounts; - e-wallets (GoPay, OVO, DANA, etc.); - savings accounts; -
investment accounts.

Account fields should include name, type, owner/scope, currency, opening
balance where appropriate, and active/archive status.

Categories should support income, expense, and investment-related
classification. Allow sensible default categories and user-manageable
categories if the existing product conventions support it.

### 3.4 Transaction types and accounting rules

Support at least: - `INCOME` - `EXPENSE` - `TRANSFER` -
`INVESTMENT_BUY` - `INVESTMENT_SELL` - `DIVIDEND` - `BALANCE_ADJUSTMENT`

Rules: - Transfers between accounts are not income or expense. -
Investment purchases move value from cash to an investment asset; they
are not household consumption expenses. - Investment sales move value
back to cash and must not be counted as income equal to the full sale
proceeds. Realized gain/loss should be modeled separately if
supported. - Dividends are investment income, not ordinary salary
income. - Do not count the same amount as both a contribution and an
investment purchase. - Store money using a safe decimal/integer
representation supported by the current database. Never use
floating-point arithmetic for financial calculations. - Validate
positive amounts, supported currencies, dates, account ownership, and
permitted scope. - Use idempotency protection for externally submitted
transactions to prevent duplicate writes.

### 3.5 Budgets and monthly plans

Support: - monthly budget period; - personal or household scope; -
planned income; - category-based expense budgets; - savings
allocation; - investment allocation; - actual versus planned
comparison; - remaining budget and percentage used.

A household plan may contain shared allocations and personal
allocations. Do not combine them in a way that leaks personal financial
details.

### 3.6 Goals

Allow users/households to define goals such as: - emergency fund; -
holiday; - home purchase; - education; - investment target.

A goal should have a target amount, target date (optional), scope/owner,
current progress, and status.

### 3.7 Investment tracking

For the initial version, support manual tracking: - investment
account/platform; - asset/instrument name and type; - buy/sell
activity; - contribution and withdrawal; - units/quantity and unit price
when applicable; - fees where relevant; - dividends; - manual valuation
snapshots.

Keep investment holdings and valuation separate from household expense
reporting. Do not require live market-price integrations for the first
release.

### 3.8 Receipts

A receipt belongs to a transaction draft or confirmed transaction.

Receipt processing must: - store uploaded images securely using the
repository's existing storage abstraction; - extract merchant, date,
total, tax, and line items when available; - record extraction
confidence and processing status; - allow user review and correction; -
detect likely duplicate uploads/transactions; - never auto-commit a
transaction from OCR output without user confirmation.

---

## 4. Web application requirements

Integrate Finance into the existing RUMA navigation and design system.

### 4.1 Finance dashboard

Show, with clear scope filters: - current month income; - current month
expenses; - net cash flow; - budget usage; - savings progress; -
investment contribution and current valuation where available; - recent
transactions; - upcoming reminders.

Provide scope selection: - Personal; - Household; - where useful, a
combined overview that does not expose another member's personal data.

### 4.2 Transactions

Users must be able to: - list, search, filter, and paginate
transactions; - filter by date, type, category, account, payer, and
scope; - create, edit, and archive/cancel transactions according to safe
accounting rules; - view transaction details and attached receipts; -
distinguish personal and household records visually; - see who paid for
a household expense.

Use confirmation for destructive or financially significant actions.
Prefer reversal/void records over hard deletion when appropriate.

### 4.3 Accounts and categories

Provide CRUD or the repository's standard management pattern for
accounts and categories, including archive/deactivate rather than
destructive deletion when referenced by transactions.

### 4.4 Budgets and reports

Provide: - monthly budget setup and editing; - actual versus planned by
category; - monthly cash-flow report; - income and expense breakdown; -
personal and household report scopes; - export only if a safe, existing
export pattern is available.

### 4.5 Goals and investments

Provide simple management and summary screens. Manual valuation is
acceptable for the initial release.

### 4.6 UX requirements

- Responsive layout, including mobile.
- Loading, empty, success, and error states.
- Form validation with understandable messages.
- Accessible labels and keyboard interactions.
- Consistent use of existing design components.
- Avoid building a second design system.

---

## 5. Telegram and Hermes Agent integration

### 5.1 Responsibility boundaries

- **Telegram:** user interaction channel.
- **Hermes Agent:** orchestration, intent understanding, tool
  selection, and conversation.
- **9Router:** LLM/model routing endpoint used by Hermes.
- **RUMA backend:** authentication, authorization, validation,
  financial business logic, and persistence.
- **Database:** canonical financial data store.

Hermes must not have direct database credentials or unrestricted
database access.

### 5.2 Integration approach

Prefer a secure RUMA API integration. If Hermes supports custom tools or
skills, implement a small, documented tool/skill layer that calls RUMA
API endpoints.

Do not expose an unauthenticated public endpoint that can create or read
financial records.

Use: - HTTPS; - service-to-service authentication for Hermes; - per-user
identity linking between Telegram and RUMA; - server-side verification
of household membership and scope; - request validation; - rate
limiting; - audit logging; - idempotency keys for write operations; -
safe handling of retries and timeouts.

Do not treat a Telegram username as a stable identity. Link the Telegram
account to an authenticated RUMA user through a one-time linking flow or
equivalent secure process. Store the Telegram numeric user ID and
linking status securely.

### 5.3 Initial tools

Implement only the tools needed for the first working vertical slice:

1.  `get_finance_context`
    - Returns the authenticated RUMA user and allowed household
      context.
2.  `list_accounts`
    - Returns only accounts accessible to the linked user.
3.  `list_categories`
    - Returns categories valid for the selected transaction type and
      scope.
4.  `create_transaction_draft`
    - Validates and creates a pending draft; does not post it to the
      ledger.
5.  `confirm_transaction`
    - Confirms a draft after explicit user confirmation.
6.  `get_monthly_summary`
    - Returns a scope-authorized monthly summary.

Add later: - `get_budget_summary`; - `create_reminder`; -
`get_investment_summary`; - `create_receipt_draft`.

### 5.4 Natural-language transaction flow

Example user message:

> Tadi makan siang 45 ribu pakai GoPay, shared.

Expected extracted draft: - type: `EXPENSE`; - amount: 45000; -
currency: `IDR`; - category: food/dining (suggested, not assumed if
ambiguous); - account: GoPay; - scope: `HOUSEHOLD`; - transaction date:
current local date unless user specifies another date; - description:
lunch; - payer: linked Telegram/RUMA user; - status:
`PENDING_CONFIRMATION`.

Bot response should summarize the interpretation and ask for
confirmation. If required information is missing or ambiguous, ask a
concise follow-up instead of guessing.

After confirmation: - call RUMA API; - enforce authorization again on
the server; - create the transaction exactly once; - return a concise
success/failure response.

Do not treat a model-generated `CONFIRM` string as proof of user
approval unless it is bound to a specific pending draft and
authenticated Telegram user. Draft confirmation should expire and be
single-use.

### 5.5 Structured input

Support an optional structured format, for example:

`expense | 45000 | food | GoPay | household | makan siang`

Natural language can be added on top, but structured input should remain
deterministic and easy to debug.

### 5.6 Conversation safety

- Never invent a successful write.
- Never claim a transaction was saved until RUMA API confirms it.
- Never expose another member's personal balance or transaction.
- Do not reveal tokens, internal prompts, credentials, or raw provider
  errors.
- Ask for confirmation before committing extracted transactions.
- A retry must not create duplicate records.
- Provide a clear correction/cancel path for pending drafts.

---

## 6. Receipt OCR and AI extraction

Implement this after the manual and Telegram transaction flow is
reliable.

Pipeline: 1. Receive image through Telegram or web upload. 2. Validate
file type, size, and content. 3. Store the image in secure storage. 4.
Send it to the configured OCR/vision provider through a server-side
adapter. 5. Parse merchant, date, total, tax, currency, and line items. 6. Match suggested categories/accounts where possible. 7. Create a
pending transaction draft with extraction confidence and source receipt. 8. Show the extracted details to the user. 9. Save only after explicit
confirmation.

Design the provider behind an interface so the OCR/vision provider can
be changed without rewriting finance business logic. Do not assume that
9Router itself provides image OCR unless verified from the actual
configured model/API.

---

## 7. Reminders and scheduled reports

Support reminder scopes: - `PERSONAL`: notify only the selected user. -
`HOUSEHOLD`: notify all active household members or explicitly selected
recipients.

Reminder concepts: - title and description; - due date/time and
timezone; - recurrence where supported; - scope and owner; -
recipients; - delivery channels; - enabled/disabled status.

Scheduled reports: - monthly household summary; - optional personal
summary; - delivery through Telegram; - configurable delivery day/time
and timezone; - do not include personal data in a household-wide message
unless the owner explicitly shares it.

Use the repository's existing scheduler/worker if one exists. Otherwise,
add a minimal background-job mechanism appropriate to the current stack.
Do not introduce distributed infrastructure prematurely.

Scheduled jobs must be idempotent and observable. Record delivery
attempts and failures without logging sensitive financial details.

---

## 8. Security, privacy, and reliability

These are release-blocking requirements:

- Enforce authorization on every backend query and mutation.
- Apply household tenant isolation consistently.
- Keep personal data private by default.
- Validate all input on the server.
- Use parameterized ORM/database operations.
- Store secrets only in environment/secret management.
- Protect webhook endpoints and service-to-service calls.
- Validate uploaded file size, type, and content.
- Do not log full receipts, account numbers, tokens, or unnecessary
  personal financial details.
- Use idempotency for Telegram and scheduled-job writes.
- Handle retries without duplicate transactions.
- Record important financial mutations and automation actions.
- Use database transactions for multi-step financial operations.
- Add tests proving one household member cannot access another
  member's personal data.

---

## 9. Suggested implementation phases

Implement these in order. Do not attempt to build every feature in one
large change.

### Phase 0 --- Audit and plan

Deliver: - repository architecture audit; - feature gap analysis; -
implementation plan; - list of assumptions and risks.

No broad code changes in this phase.

### Phase 1 --- Finance foundation

Deliver: - schema and additive migrations for finance concepts missing
from the repository; - personal/household ownership model; - accounts
and categories; - transaction domain rules; - authorization and tenant
isolation; - unit/integration tests.

Acceptance criteria: - authenticated user can create and view their own
personal transaction; - authorized household member can create and view
household transaction; - another user's personal transaction cannot be
accessed; - transfers do not affect income/expense totals; - money
calculations do not use floating-point arithmetic.

### Phase 2 --- Web finance experience

Deliver: - finance dashboard; - transaction list and filters; -
create/edit transaction flow; - account and category management; -
personal/household scope switching; - monthly summary.

Acceptance criteria: - user can manage personal and household
transactions from the web; - dashboard totals match transaction data; -
personal data is not leaked into household views; - responsive UI and
useful empty/error states exist.

### Phase 3 --- Budgeting and planning

Deliver: - monthly budgets; - category allocations; - savings/investment
allocations; - actual-versus-planned reporting; - goals if the core
budget design is stable.

Acceptance criteria: - budget totals and remaining amounts are
calculated correctly; - personal and household plans remain separated; -
changing a budget does not mutate historical transactions.

### Phase 4 --- Telegram/Hermes integration

Deliver: - secure Telegram-to-RUMA user linking; - service-to-service
authentication; - Hermes tool/skill integration; - account/category
lookup; - transaction draft and confirmation; - monthly summary query.

Acceptance criteria: - linked user can create a pending draft from
Telegram; - ambiguous details trigger clarification; - unlinked users
cannot access finance data; - confirmation creates one transaction
only; - retries do not create duplicates; - unauthorized
household/personal access is rejected.

### Phase 5 --- Receipt OCR

Deliver: - secure receipt upload; - OCR/vision adapter; - extraction and
confidence; - pending transaction draft; - user review and
confirmation; - duplicate detection.

Acceptance criteria: - image extraction never commits a transaction
automatically; - user can correct extracted fields; - unsupported or
low-confidence images produce a useful response.

### Phase 6 --- Reminders, reports, and investments

Deliver: - personal/shared reminders; - scheduled monthly Telegram
reports; - manual investment activity and valuation tracking; -
investment summaries separated from ordinary expense totals.

Acceptance criteria: - personal reminder reaches only its intended
recipient; - household reminder reaches configured household
recipients; - monthly reports are sent once per period and scope; -
investment purchases are not counted as consumption expenses.

---

## 10. Testing strategy

Add tests appropriate to the existing stack.

Minimum coverage: - amount validation and decimal precision; -
transaction type accounting rules; - personal versus household
authorization; - household membership enforcement; - account and
category ownership; - idempotent transaction creation; - draft
confirmation and expiry; - Telegram identity linking; - monthly
aggregation; - budget calculations; - reminder recipient resolution; -
scheduled report idempotency; - receipt upload validation.

Use unit tests for domain logic and integration tests for API
authorization and persistence. Add end-to-end tests for critical web
flows if the repository already has an E2E setup.

Never weaken or delete existing tests simply to make the new
implementation pass.

---

## 11. Environment variables and documentation

Inspect existing environment variable conventions before adding
anything.

Potential variables (names are illustrative; adapt to project
conventions): - `HERMES_API_BASE_URL` - `HERMES_SERVICE_TOKEN` -
`TELEGRAM_BOT_TOKEN` (only if RUMA backend itself needs it; otherwise
keep it in Hermes runtime) - `OCR_PROVIDER` - `OCR_API_KEY` - storage
configuration already used by the app

Do not put the 9Router API key in browser/client-side code. Prefer
keeping model-provider credentials in the Hermes runtime, not in the
RUMA frontend or database.

Document: - local setup; - migrations; - environment configuration; -
Telegram linking flow; - Hermes tool/skill configuration; - how to run
tests; - known limitations.

---

## 12. Out of scope for the first working release

Do not implement these before the core finance and Telegram transaction
flow is stable:

- direct bank account synchronization;
- automatic broker synchronization;
- automatic live market-price feeds;
- complex accounting/tax reporting;
- multi-currency conversion and FX gains/losses;
- automatic payment execution;
- autonomous transfers or purchases;
- AI agent access to raw database credentials;
- microservices decomposition;
- a complete rewrite of the existing RUMA stack.

---

## 13. Definition of done

A phase is done only when: - implementation follows existing repository
conventions; - schema changes have migrations; - server-side validation
and authorization are present; - relevant tests pass; -
lint/type-check/build pass, or existing unrelated failures are clearly
identified; - documentation and `.env.example` are updated where
needed; - no secrets or real user financial data are committed; - the
final response explains what changed, files touched, commands/tests run,
and remaining manual setup.

At the end of each phase, provide: 1. Summary of implementation. 2.
Important files created/modified. 3. Database migration instructions. 4.
Commands executed and test results. 5. Known limitations or risks. 6.
Recommended next phase.

---

## 14. First prompt to run in Copilot Agent

After adding this file to the repository root, give Copilot Agent this
prompt:

> Read `COPILOT_AGENT_IMPLEMENTATION.md` completely and follow it as the
> source of truth for this task. Start with Phase 0 only: inspect the
> existing RUMA repository, identify the current architecture and
> reusable functionality, compare it against the requirements, and
> create `docs/finance-implementation-plan.md`. Do not make broad
> implementation changes yet. Report the plan, risks, assumptions, and
> the first vertical slice you recommend. Preserve the existing
> application and its current stack.

Once the audit is reviewed, continue with:

> Implement Phase 1 from `COPILOT_AGENT_IMPLEMENTATION.md` using the
> approved implementation plan. Work incrementally, add migrations and
> tests, preserve existing functionality, and report all changed files
> and verification results. Do not start Phase 2 until Phase 1 is
> complete and verified.
