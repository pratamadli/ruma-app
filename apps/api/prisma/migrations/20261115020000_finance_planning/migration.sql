ALTER TABLE "budgets"
  ADD COLUMN "scope" "FinanceScope" NOT NULL DEFAULT 'HOUSEHOLD',
  ADD COLUMN "owner_user_id" CHAR(26) REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN "planned_income_minor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "savings_allocation_minor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "investment_allocation_minor" BIGINT NOT NULL DEFAULT 0;
DROP INDEX "budgets_family_id_period_month_key";
CREATE UNIQUE INDEX "budgets_family_id_period_month_owner_user_id_key" ON "budgets"("family_id", "period_month", "owner_user_id");
CREATE UNIQUE INDEX "budgets_household_month_key" ON "budgets"("family_id", "period_month") WHERE "scope" = 'HOUSEHOLD';
ALTER TABLE "budgets" ADD CONSTRAINT "budget_scope_owner"
  CHECK (("scope" = 'PERSONAL' AND "owner_user_id" IS NOT NULL) OR ("scope" = 'HOUSEHOLD' AND "owner_user_id" IS NULL));

CREATE TABLE "finance_goals" (
  "id" CHAR(26) PRIMARY KEY,
  "family_id" CHAR(26) NOT NULL REFERENCES "families"("id") ON DELETE CASCADE,
  "scope" "FinanceScope" NOT NULL DEFAULT 'HOUSEHOLD',
  "owner_user_id" CHAR(26) REFERENCES "users"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "target_amount_minor" BIGINT NOT NULL CHECK ("target_amount_minor" > 0),
  "current_amount_minor" BIGINT NOT NULL DEFAULT 0 CHECK ("current_amount_minor" >= 0),
  "target_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "goal_scope_owner" CHECK (("scope" = 'PERSONAL' AND "owner_user_id" IS NOT NULL) OR ("scope" = 'HOUSEHOLD' AND "owner_user_id" IS NULL))
);
CREATE INDEX "finance_goals_family_id_scope_owner_user_id_idx" ON "finance_goals"("family_id", "scope", "owner_user_id");
