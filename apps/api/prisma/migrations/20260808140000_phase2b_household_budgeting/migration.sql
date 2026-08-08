-- Phase 2B: Household Budgeting (ADR-011)

CREATE TYPE "BudgetRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "budgets" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "period_month" CHAR(7) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "total_amount_minor" BIGINT,
    "status" "BudgetRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_items" (
    "id" CHAR(26) NOT NULL,
    "budget_id" CHAR(26) NOT NULL,
    "category_id" CHAR(26) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budgets_family_id_period_month_key" ON "budgets"("family_id", "period_month");
CREATE INDEX "budgets_family_id_status_period_month_idx" ON "budgets"("family_id", "status", "period_month");

CREATE UNIQUE INDEX "budget_items_budget_id_category_id_key" ON "budget_items"("budget_id", "category_id");
CREATE INDEX "budget_items_category_id_idx" ON "budget_items"("category_id");

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
