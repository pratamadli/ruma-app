-- Phase 2D: Email transaction import (ADR-013)

CREATE TYPE "EmailProviderKind" AS ENUM ('SYNTHETIC', 'GMAIL');
CREATE TYPE "EmailConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "ImportCandidateStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'IGNORED', 'FAILED');
CREATE TYPE "ImportConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

CREATE TABLE "email_connections" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "provider" "EmailProviderKind" NOT NULL,
    "status" "EmailConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "email_address" TEXT NOT NULL,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "scopes" TEXT,
    "connected_by_id" CHAR(26) NOT NULL,
    "last_synced_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_candidates" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "connection_id" CHAR(26) NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "parser_provider" TEXT NOT NULL,
    "status" "ImportCandidateStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confidence" "ImportConfidence" NOT NULL DEFAULT 'MEDIUM',
    "transaction_type" "TransactionType",
    "amount_minor" BIGINT,
    "currency" CHAR(3),
    "transaction_date" DATE,
    "description" TEXT,
    "merchant" TEXT,
    "reference" TEXT,
    "account_hint" TEXT,
    "category_hint" TEXT,
    "suggested_account_id" CHAR(26),
    "suggested_category_id" CHAR(26),
    "suggested_transfer_account_id" CHAR(26),
    "fingerprint" TEXT,
    "possible_duplicate_transaction_id" CHAR(26),
    "confirmed_transaction_id" CHAR(26),
    "parse_error" TEXT,
    "reviewed_by_id" CHAR(26),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_connections_family_id_provider_email_address_key" ON "email_connections"("family_id", "provider", "email_address");
CREATE INDEX "email_connections_family_id_status_idx" ON "email_connections"("family_id", "status");

CREATE UNIQUE INDEX "import_candidates_connection_id_provider_message_id_key" ON "import_candidates"("connection_id", "provider_message_id");
CREATE INDEX "import_candidates_family_id_status_created_at_idx" ON "import_candidates"("family_id", "status", "created_at" DESC);
CREATE INDEX "import_candidates_family_id_fingerprint_idx" ON "import_candidates"("family_id", "fingerprint");

ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "email_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
