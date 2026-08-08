# RUMA — Product PRD

## Phase 1 MVP (product version `1.1.x`)

- Authentication
- Family Workspace (create family, invite members, membership)
- Household Dashboard (today’s tasks, grocery state, upcoming events, recent activity)
- Tasks / Chores (assign, due date, status, complete)
- Shared Grocery (fast add / check-off)
- Family Calendar (agenda / upcoming)
- In-app Notifications (unread count, mark read)
- Activity Feed

## Phase 2A — Household Finance (product version `2.0.0`)

Approachable household money tracking — not accounting software.

- Financial accounts (bank, cash, e-wallet, credit card)
- Manual income / expense / transfer entry
- Categories (seeded + custom; deactivate instead of hard delete)
- Account balances (server-authoritative)
- Transaction history with basic filters
- Monthly summary + Finance dashboard (“how are we doing this month?”)
- Privacy: no finance amounts in general activity/notifications

## Phase 2B — Budgeting (product version `2.1.0`)

- Monthly household spending ceiling (optional)
- Category envelopes linked to existing expense categories
- Progress, remaining, over-budget state (server-calculated)
- Budgets page with month navigation + Finance overview summary
- UI alerts only — no email/scheduled notification jobs

## Phase 2C — Financial Intelligence (product version `2.2.0`)

- Monthly spending / income / net trends
- Month-over-month comparison
- Top categories + share
- Recurring pattern detection (heuristic, non-destructive)
- Calm anomaly signals + deterministic insights
- Finance Overview as the primary intelligence surface

### Phase 2D — Automatic Transaction Capture (product version `2.3.0`)

- Connect email (demo inbox / optional Gmail readonly)
- Deterministic parse → review queue (confirm / edit / ignore)
- Confirmed imports become normal ledger transactions
- AI categorization deferred

## Phase 3 — Home Management

- Home Profile, Rooms, Assets, Maintenance
- Documents, Notes, Knowledge Hub
- Technician/Service Contact Directory

## Later — Smart Finance extensions & Complete Product

- Bills, savings, debt, insurance, investments, net worth
- Deeper automation and monthly AI financial reports
- Receipt OCR, pantry, family goals, child/pet profiles, travel
- Subscriptions, home timeline, AI household assistant
- Admin and subscription platform

## Non-goals for current release

- Bank API integrations
- Investment / net-worth engines
- Aggressive “you spent money” notifications
