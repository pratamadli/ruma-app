CREATE TYPE "FinanceScope" AS ENUM ('PERSONAL', 'HOUSEHOLD');
ALTER TYPE "FinancialAccountType" ADD VALUE 'SAVINGS';
ALTER TYPE "FinancialAccountType" ADD VALUE 'INVESTMENT';
ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT_BUY';
ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT_SELL';
ALTER TYPE "TransactionType" ADD VALUE 'DIVIDEND';
ALTER TYPE "TransactionType" ADD VALUE 'BALANCE_ADJUSTMENT';
ALTER TYPE "CategoryKind" ADD VALUE 'INVESTMENT';
ALTER TYPE "TransactionSource" ADD VALUE 'TELEGRAM';
ALTER TYPE "TransactionSource" ADD VALUE 'RECEIPT';

ALTER TABLE "financial_accounts" ADD COLUMN "scope" "FinanceScope" NOT NULL DEFAULT 'HOUSEHOLD';
ALTER TABLE "financial_accounts" ADD CONSTRAINT "personal_account_owner"
  CHECK ("scope" <> 'PERSONAL' OR "owner_user_id" IS NOT NULL);
ALTER TABLE "transactions"
  ADD COLUMN "scope" "FinanceScope" NOT NULL DEFAULT 'HOUSEHOLD',
  ADD COLUMN "owner_user_id" CHAR(26) REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN "payer_user_id" CHAR(26) REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN "adjustment_direction" TEXT,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_hash" TEXT;
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_scope_owner"
  CHECK (("scope" = 'PERSONAL' AND "owner_user_id" IS NOT NULL)
      OR ("scope" = 'HOUSEHOLD' AND "owner_user_id" IS NULL));
CREATE UNIQUE INDEX "transactions_family_id_idempotency_key_key" ON "transactions"("family_id", "idempotency_key");
CREATE INDEX "transactions_family_id_scope_owner_user_id_transaction_date_idx"
  ON "transactions"("family_id", "scope", "owner_user_id", "transaction_date");

CREATE TABLE "finance_audits" (
  "id" CHAR(26) PRIMARY KEY,
  "family_id" CHAR(26) NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "actor_id" CHAR(26) NOT NULL,
  "resource_id" CHAR(26) NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "finance_audits_family_id_created_at_idx" ON "finance_audits"("family_id", "created_at");
