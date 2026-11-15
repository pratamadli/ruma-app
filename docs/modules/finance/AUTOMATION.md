# Assisted finance setup

## Trust boundary

RUMA owns the ledger and household authorization. Hermes prepares drafts through
the API; 9Router/model keys remain in the Hermes runtime. No database credentials
are given to Hermes. All provider features are disabled until configured.

Choose **one** Telegram update owner:

- **Local Hermes Gateway (existing deployment):** Vercel/Railway remain online;
  the local gateway handles Telegram. Use the connection plugin below. Do not
  replace the gateway's Telegram transport with a RUMA webhook.
- **RUMA-owned Telegram transport:** set server-only `HERMES_SERVICE_TOKEN`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. Configure `setWebhook` to the HTTPS URL
  `/v1/integrations/telegram/webhook`, setting Telegram's `secret_token` to the same
  webhook secret. Do not run Hermes polling against this same bot.

Restrict deployment/gateway logs from recording credentials or connection
commands. The global API throttle applies to integration routes.

## Connect a household to the shared bot

1. Sign in to RUMA and open the intended household dashboard.
2. Click **Connect to Telegram** (also available in Finance > Capture).
3. Copy the generated command and send it privately to the configured bot:

   ```text
   /ruma connect your-email@example.com ABCD-1234-ABCD-1234-ABCD-1234
   ```

   Email and code may also be on separate lines after `/ruma connect`.

4. The backend verifies the code's issuing user, normalized email, expiry and
   active membership in the code's household. The bot reports the household
   name; the dashboard automatically refreshes its connection status.

Codes expire after ten minutes, contain 96 bits of randomness, are stored only
as SHA-256 hashes, and are consumed once atomically. Generating another code
invalidates the previous one. **The code is bound to both the signed-in user and
the selected household.** It is not a reusable household invitation: another
member must sign in and generate their own code, not substitute their email.
Never send passwords to the bot.

A numeric Telegram identity maps to one RUMA user and one active household.
Many users and households can share the same bot. Connecting the same user to
another authorized household requires a new dashboard code and switches the
active context; issuing the code alone does not switch it. To change Telegram
accounts, first disconnect the old account in its household dashboard.
`/ruma status` shows the current household; `/ruma disconnect` revokes it.

All Telegram/Hermes finance requests are restricted to that active household,
even if the user belongs to several. Old draft buttons from a different
household stop working after a switch; the user can still review their own
drafts on the web. Scheduled delivery also requires a connection to the
schedule's household. Membership removal immediately blocks further access.
Usernames, household names and model-supplied IDs are never authorization.

Migration `20261115060000_telegram_household_link` adds the household/code
bindings. Previous unscoped codes are invalidated and existing Telegram users
must reconnect explicitly; no household is inferred from their memberships.

## Native Hermes connection plugin

[The connection plugin](../../../integrations/hermes/ruma-connection) implements
`/ruma connect`, `/ruma status`, and `/ruma disconnect` using Hermes's registered
slash-command API. It runs outside the LLM, derives sender identity from the
gateway's `SessionSource`, and rejects groups, bot senders, missing identity and
chat/sender mismatches. It has no model-callable connect/confirm tool and no
cross-user in-memory connection cache.

After deploying the migration and RUMA API:

1. Verify the actual Railway API origin and `/v1/health`; do not assume a stale
   documented hostname is still deployed.
2. On the RUMA API, configure a random `HERMES_SERVICE_TOKEN`. Optionally set
   `TELEGRAM_BOT_USERNAME` (without `@`) to show an Open Telegram button.
3. In the Hermes profile environment (locate with `hermes config env-path`), set:

   ```dotenv
   RUMA_API_URL=https://your-verified-api-host.example
   HERMES_SERVICE_TOKEN=the-same-server-side-service-token
   ```

   Use the API **origin**, without `/v1`. HTTPS is required except for explicit
   loopback development URLs. Redirects are rejected so authentication cannot
   be forwarded to a different host. Do not use the Hermes dashboard/WebSocket
   URL for `RUMA_API_URL`.

4. Copy the plugin folder into `<Hermes profile>\plugins\ruma-connection`.
   Do not overwrite an existing installation without reviewing/backing it up.
   `hermes config path` identifies the active profile. Gateway sessions do not
   load project-local `.hermes/plugins` folders.
5. Run `hermes plugins enable ruma-connection`, then stop/start the gateway during
   an agreed maintenance window (`hermes gateway stop`, `hermes gateway start`).
   Configure the Telegram allowlist for the intended members; linking does not
   bypass Hermes's own transport allowlist.
6. Generate a dashboard code and test the command from an allowed private chat.

**Before allowing unrelated households:** use a dedicated Hermes profile/runtime
with a reviewed tool allowlist. Do not expose the personal gateway's general
terminal, file access, code execution or secret access to arbitrary Telegram
users. An unrestricted agent that can read service credentials is not a safe
multi-tenant boundary. Keep credential access and transport identity in trusted
runtime code, never model arguments.

The plugin only implements connection management. It does not silently install
finance tools, change the model's persona, send financial transactions, or
forward confirmation callbacks. A trusted finance-tool/callback bridge is still
needed for full natural-language finance capture through the existing Hermes
Gateway; use web confirmation until that bridge is configured. This plugin does
not start another Telegram poller or require inbound access to the PC.

Validation from the repository root:

```powershell
python -B -m unittest discover -s .\integrations\hermes\ruma-connection -p 'test_*.py' -v
hermes plugins validate .\integrations\hermes\ruma-connection
```

## Hermes tools

Call `POST /v1/integrations/hermes/tools` over HTTPS with:

- `Authorization: Bearer <HERMES_SERVICE_TOKEN>`
- `x-telegram-user-id`: verified numeric sender ID supplied by trusted runtime
  context, never an argument selected by the model.

JSON tools:

```json
{"tool":"get_finance_context"}
{"tool":"list_accounts","familyId":"<26-char-family-id>","scope":"PERSONAL"}
{"tool":"list_categories","familyId":"<26-char-family-id>"}
{"tool":"get_monthly_summary","familyId":"<26-char-family-id>","query":{"scope":"HOUSEHOLD","month":"2026-11"}}
{"tool":"create_transaction_draft","familyId":"<26-char-family-id>","input":{"idempotencyKey":"stable-telegram-update-key","transaction":{"type":"EXPENSE","amountMinor":"45000","accountId":"<26-char-account-id>","scope":"PERSONAL","transactionDate":"2026-11-15"}}}
{"tool":"confirm_transaction","familyId":"<26-char-family-id>","draftId":"<26-char-draft-id>"}
```

`confirm_transaction` returns the confirmation buttons or the already-confirmed
result. It **cannot authorize a write**. Display returned `confirmation` as
Telegram inline buttons; only a secret-authenticated Telegram callback from the
linked private-chat user, or a JWT-authenticated web confirmation, posts the
ledger. This deliberately prevents a model from confirming its own draft.
Drafts expire after 15 minutes; retries produce one draft/transaction.
Corrections replace the draft and invalidate its old confirmation.

Structured capture is available without an LLM:

```text
expense | 45000 | Food & Dining | GoPay | household | lunch
```

Names must resolve uniquely within the connected household. `get_finance_context`
returns only that household; tools cannot select a different one through their
arguments. Dates use the connected household's timezone.

## Optional natural-language adapter

`HERMES_INTENT_URL` is a **custom adapter contract**, not an assumed native Hermes
endpoint. Implement an HTTPS bridge in your Hermes runtime and configure
`HERMES_INTENT_TOKEN`. RUMA posts `{text,familyId,userId,localDate,instruction}`.
Return `{transaction: <validated transaction fields>}` or
`{clarification: "Question for the user"}`. Resolve IDs with the tools above.
Set the sender's trusted runtime context outside model arguments.

The bridge routes inference through your configured 9Router-compatible model.
Do not expose model/provider keys to the browser. This repository does not assume
9Router supports vision. Provider unavailability never fabricates a saved record.
Live Telegram/Hermes/9Router setup must be smoke-tested by the deployment operator.

## Receipt review

Configure an absolute `FINANCE_RECEIPT_DIR` on a persistent API volume with access
restricted to the API user. Do not serve the directory statically. Back up receipt
files together with PostgreSQL; deleting a family does not erase files from volume
backups. Apply your retention policy operationally.

Finance > Capture accepts PNG/JPEG up to 5 MB and 16 million pixels. The server
decodes/re-encodes images to strip metadata, stores them privately and detects
duplicate images per owner. `GET .../receipts/:id/file` requires authorization;
household members see a receipt only after it is attached to a confirmed shared
transaction. Pending receipts remain private to the uploader.

Optional OCR: implement an HTTPS adapter at `OCR_PROVIDER_URL`, authenticated with
`OCR_PROVIDER_TOKEN`. Request: `{imageBase64,mimeType}`. Response:
`{merchant?,date?,totalMinor?,taxMinor?,currency?:"IDR",confidence:0..1,lineItems?:[{description,amountMinor}]}`.
Money must be integer strings. Invalid/unavailable/low-confidence extraction asks
for manual review. OCR is not assumed to be a native 9Router capability.

Upload creates a review record, never a transaction. Select the account and
correct extracted details to create a pending draft, then explicitly confirm it.
Corrections invalidate the old draft/button. Similar date/type/amount entries
produce a duplicate warning. Initial image capture is web-based; Telegram image
transport is not enabled. Neither mock extraction nor an unconfigured provider
is represented as a successful live OCR integration.

## Investments and scheduled delivery

Finance > Investments maintains manual positions and dated valuation snapshots.
Use Transactions for buys/sells/dividends and optional quantity, unit price and
fees. The principal is quantity times unit price rounded to whole rupiah; fees
are additional on buys and deducted from proceeds on sells. Positions are not
automatically synchronized from trades. Archive a closed position; no broker,
price-feed, performance/tax or realized-gain engine is included.

Finance > Reminders creates one-time reminders and monthly reports. Choose an
IANA timezone and linked recipients. Personal delivery is owner-only. Shared
empty recipient lists expand to all active members; explicit lists exclude
unselected members. Reports summarize the previous calendar month in that scope.
One report configuration exists per scope/owner, including disabled reports.

Enable `FINANCE_JOBS_ENABLED=true` only after validating Telegram configuration
and recipients. The lifecycle-managed API worker checks schedules every minute;
keep at least one API instance awake. Day 1-28 avoids month-length ambiguity.
It catches up a due report in the current month, not an unbounded historical
backfill. For DST gaps it sends at the first subsequent check; repeated local
hours cannot duplicate a period.

Delivery records atomically claim each schedule/recipient/period. Successful
deliveries are never repeated. Provider timeouts, interrupted in-flight workers,
and post-send database failures become UNCERTAIN, not automatically retried.
Known failures become FAILED, with safe error codes exposed on the schedule.
There is intentionally no blind retry endpoint. Operators must first reconcile
Telegram delivery, fix configuration/membership and explicitly requeue only a
verified unsent delivery through a controlled database maintenance operation.
Never delete SENT/UNCERTAIN records just to force another send. A removed creator
causes the job to log and skip; an active household member can disable the old
configuration. Financial content is not logged.

This provides durable at-most-once automatic send attempts, not a promise of
exactly-once delivery across external-network failures.
