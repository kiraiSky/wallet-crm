DO $$ BEGIN
  CREATE TYPE "MoloniSyncStatus" AS ENUM ('SUCCESS', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "moloni_connections" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "client_id" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "token_expires_at" TIMESTAMP(3) NOT NULL,
  "company_id" INTEGER,
  "company_name" TEXT,
  "company_vat" TEXT,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_sync_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "moloni_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "connection_id" TEXT NOT NULL REFERENCES "moloni_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "document_id" INTEGER NOT NULL,
  "document_type_id" INTEGER NOT NULL,
  "document_set_id" INTEGER,
  "number" INTEGER,
  "date" TIMESTAMP(3),
  "expiration_date" TIMESTAMP(3),
  "entity_name" TEXT,
  "entity_vat" TEXT,
  "gross_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxes_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" INTEGER,
  "saft_code" TEXT,
  "raw" JSONB NOT NULL,
  "modified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "moloni_sync_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "connection_id" TEXT NOT NULL REFERENCES "moloni_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" "MoloniSyncStatus" NOT NULL,
  "message" TEXT,
  "documents_seen" INTEGER NOT NULL DEFAULT 0,
  "documents_saved" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "moloni_documents_connection_id_document_id_key"
  ON "moloni_documents"("connection_id", "document_id");
CREATE INDEX IF NOT EXISTS "moloni_documents_entity_vat_idx" ON "moloni_documents"("entity_vat");
CREATE INDEX IF NOT EXISTS "moloni_documents_date_idx" ON "moloni_documents"("date");
CREATE INDEX IF NOT EXISTS "moloni_documents_modified_at_idx" ON "moloni_documents"("modified_at");
CREATE INDEX IF NOT EXISTS "moloni_sync_logs_connection_id_idx" ON "moloni_sync_logs"("connection_id");
CREATE INDEX IF NOT EXISTS "moloni_sync_logs_started_at_idx" ON "moloni_sync_logs"("started_at");
