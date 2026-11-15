ALTER TABLE "transactions"
  ADD COLUMN "instrument_name" TEXT,
  ADD COLUMN "units_decimal" TEXT,
  ADD COLUMN "unit_price_minor" BIGINT,
  ADD COLUMN "fees_minor" BIGINT NOT NULL DEFAULT 0;
CREATE TABLE "investment_positions" (
  "id" CHAR(26) PRIMARY KEY,
  "family_id" CHAR(26) NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "owner_user_id" CHAR(26) REFERENCES "users"("id") ON DELETE RESTRICT,
  "scope" "FinanceScope" NOT NULL,
  "account_id" CHAR(26) NOT NULL REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
  "instrument_name" TEXT NOT NULL, "asset_type" TEXT NOT NULL, "units_decimal" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "position_scope_owner" CHECK (("scope" = 'PERSONAL' AND "owner_user_id" IS NOT NULL) OR ("scope" = 'HOUSEHOLD' AND "owner_user_id" IS NULL))
);
CREATE INDEX "investment_positions_family_id_scope_owner_user_id_idx" ON "investment_positions"("family_id", "scope", "owner_user_id");
CREATE TABLE "investment_valuations" (
  "id" CHAR(26) PRIMARY KEY,
  "position_id" CHAR(26) NOT NULL REFERENCES "investment_positions"("id") ON DELETE CASCADE,
  "valuation_date" DATE NOT NULL, "value_minor" BIGINT NOT NULL CHECK ("value_minor" >= 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "investment_valuations_position_id_valuation_date_key" ON "investment_valuations"("position_id", "valuation_date");
CREATE TABLE "finance_schedules" (
  "id" CHAR(26) PRIMARY KEY,
  "family_id" CHAR(26) NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "created_by_id" CHAR(26) NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "owner_user_id" CHAR(26),
  "scope" "FinanceScope" NOT NULL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "due_at" TIMESTAMPTZ(6), "timezone" TEXT NOT NULL,
  "delivery_day" INTEGER NOT NULL DEFAULT 1, "delivery_hour" INTEGER NOT NULL DEFAULT 9, "delivery_minute" INTEGER NOT NULL DEFAULT 0,
  "recipient_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedule_scope_owner" CHECK (("scope" = 'PERSONAL' AND "owner_user_id" = "created_by_id") OR ("scope" = 'HOUSEHOLD' AND "owner_user_id" IS NULL))
);
CREATE INDEX "finance_schedules_enabled_due_at_idx" ON "finance_schedules"("enabled", "due_at");
CREATE UNIQUE INDEX "finance_schedules_monthly_scope_key" ON "finance_schedules"("family_id", "scope", COALESCE("owner_user_id", '')) WHERE "kind" = 'MONTHLY_REPORT';
CREATE TABLE "finance_deliveries" (
  "id" CHAR(26) PRIMARY KEY,
  "schedule_id" CHAR(26) NOT NULL REFERENCES "finance_schedules"("id") ON DELETE CASCADE,
  "recipient_id" CHAR(26) NOT NULL, "period_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0, "error_code" TEXT,
  "delivered_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX "finance_deliveries_schedule_id_recipient_id_period_key_key" ON "finance_deliveries"("schedule_id", "recipient_id", "period_key");
