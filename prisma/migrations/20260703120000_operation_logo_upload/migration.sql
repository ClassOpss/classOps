-- Teacher-uploadable operation logo, stored in Postgres (Railway's FS is ephemeral).
-- Nullable: existing operations keep their file-based logoPath until a logo is uploaded.
ALTER TABLE "operations" ADD COLUMN "logo_data" BYTEA;
ALTER TABLE "operations" ADD COLUMN "logo_mime" TEXT;
