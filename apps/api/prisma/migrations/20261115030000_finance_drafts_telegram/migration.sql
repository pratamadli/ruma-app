CREATE TABLE "telegram_links" (
  "user_id" CHAR(26) PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "telegram_id" TEXT UNIQUE,
  "code_hash" TEXT UNIQUE,
  "code_expires_at" TIMESTAMPTZ(6),
  "linked_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE "finance_drafts" (
  "id" CHAR(26) PRIMARY KEY,
  "family_id" CHAR(26) NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "owner_user_id" CHAR(26) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" "FinanceScope" NOT NULL,
  "payload" JSONB NOT NULL,
  "source" "TransactionSource" NOT NULL DEFAULT 'TELEGRAM',
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "transaction_id" CHAR(26),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX "finance_drafts_family_id_owner_user_id_idempotency_key_key" ON "finance_drafts"("family_id", "owner_user_id", "idempotency_key");
CREATE INDEX "finance_drafts_family_id_owner_user_id_status_idx" ON "finance_drafts"("family_id", "owner_user_id", "status");
