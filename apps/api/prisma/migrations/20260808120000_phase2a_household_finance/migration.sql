-- Phase 2A: Household Finance foundation (ADR-010)

CREATE TYPE "FinancialAccountType" AS ENUM ('BANK', 'CASH', 'E_WALLET', 'CREDIT_CARD', 'OTHER');
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'IMPORT');

ALTER TABLE "families" ADD COLUMN "default_currency" CHAR(3) NOT NULL DEFAULT 'IDR';

CREATE TABLE "financial_accounts" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL DEFAULT 'BANK',
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "initial_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "owner_user_id" CHAR(26),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transaction_categories" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "account_id" CHAR(26) NOT NULL,
    "transfer_account_id" CHAR(26),
    "category_id" CHAR(26),
    "description" TEXT,
    "transaction_date" DATE NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "source_reference" TEXT,
    "confidence" INTEGER,
    "created_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_accounts_family_id_is_active_idx" ON "financial_accounts"("family_id", "is_active");
CREATE INDEX "financial_accounts_family_id_deleted_at_idx" ON "financial_accounts"("family_id", "deleted_at");

CREATE UNIQUE INDEX "transaction_categories_family_id_name_kind_key" ON "transaction_categories"("family_id", "name", "kind");
CREATE INDEX "transaction_categories_family_id_kind_is_active_idx" ON "transaction_categories"("family_id", "kind", "is_active");

CREATE INDEX "transactions_family_id_transaction_date_idx" ON "transactions"("family_id", "transaction_date" DESC);
CREATE INDEX "transactions_family_id_type_transaction_date_idx" ON "transactions"("family_id", "type", "transaction_date");
CREATE INDEX "transactions_family_id_account_id_transaction_date_idx" ON "transactions"("family_id", "account_id", "transaction_date");
CREATE INDEX "transactions_family_id_category_id_transaction_date_idx" ON "transactions"("family_id", "category_id", "transaction_date");
CREATE INDEX "transactions_family_id_deleted_at_idx" ON "transactions"("family_id", "deleted_at");

ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_account_id_fkey" FOREIGN KEY ("transfer_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
