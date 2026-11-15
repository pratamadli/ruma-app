CREATE TABLE "finance_receipts" (
  "id" CHAR(26) PRIMARY KEY,
  "family_id" CHAR(26) NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "owner_user_id" CHAR(26) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" "FinanceScope" NOT NULL,
  "storage_key" TEXT NOT NULL UNIQUE,
  "sha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "extraction" JSONB NOT NULL DEFAULT '{}',
  "error_code" TEXT,
  "transaction_id" CHAR(26) REFERENCES "transactions"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX "finance_receipts_family_id_owner_user_id_sha256_key" ON "finance_receipts"("family_id", "owner_user_id", "sha256");
ALTER TABLE "finance_drafts" ADD COLUMN "receipt_id" CHAR(26) REFERENCES "finance_receipts"("id") ON DELETE SET NULL;
