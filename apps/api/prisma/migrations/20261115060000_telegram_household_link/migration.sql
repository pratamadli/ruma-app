ALTER TABLE "telegram_links"
  ADD COLUMN "family_id" CHAR(26),
  ADD COLUMN "code_family_id" CHAR(26);

ALTER TABLE "telegram_links"
  ADD CONSTRAINT "telegram_links_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "telegram_links_code_family_id_fkey" FOREIGN KEY ("code_family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "telegram_links_family_id_idx" ON "telegram_links"("family_id");
CREATE INDEX "telegram_links_code_family_id_idx" ON "telegram_links"("code_family_id");

-- Legacy codes did not prove a household selection; require a new connection.
UPDATE "telegram_links" SET "code_hash" = NULL, "code_expires_at" = NULL;
