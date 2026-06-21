-- Multi-tenancy foundation: Operation (tenant) table + operation_id scoping columns.
-- Strategy for existing single-tenant data: add columns nullable, backfill to a
-- seeded default operation, then enforce NOT NULL on the required ones.

-- CreateTable
CREATE TABLE "operations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brand_name" TEXT NOT NULL,
    "brand_signature" TEXT NOT NULL,
    "logo_path" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "daily_deadline_hour" INTEGER NOT NULL DEFAULT 21,
    "weekly_deadline_weekday" INTEGER NOT NULL DEFAULT 6,
    "weekly_deadline_hour" INTEGER NOT NULL DEFAULT 21,
    "per_class_salary" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "office_hour_bonus" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "late_deduction" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "coverage_adjustment" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "pay_multiplier" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operations_slug_key" ON "operations"("slug");

-- Seed the default operation (backfill target for the existing single-tenant data).
INSERT INTO "operations" ("id", "name", "slug", "brand_name", "brand_signature", "logo_path")
VALUES ('00000000-0000-0000-0000-000000000001', 'Math by Mo', 'math-by-mo', 'Math by Mo', 'Team MO', '/logos/teacher1.png');

-- users: super-admin (role=admin) stays NULL; teachers + assistants -> default op.
ALTER TABLE "users" ADD COLUMN "operation_id" TEXT;
UPDATE "users" SET "operation_id" = '00000000-0000-0000-0000-000000000001' WHERE "role" <> 'admin';

-- schools
ALTER TABLE "schools" ADD COLUMN "operation_id" TEXT;
UPDATE "schools" SET "operation_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "schools" ALTER COLUMN "operation_id" SET NOT NULL;

-- classes
ALTER TABLE "classes" ADD COLUMN "operation_id" TEXT;
UPDATE "classes" SET "operation_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "classes" ALTER COLUMN "operation_id" SET NOT NULL;

-- assistants
ALTER TABLE "assistants" ADD COLUMN "operation_id" TEXT;
UPDATE "assistants" SET "operation_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "assistants" ALTER COLUMN "operation_id" SET NOT NULL;

-- topics
ALTER TABLE "topics" ADD COLUMN "operation_id" TEXT;
UPDATE "topics" SET "operation_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "topics" ALTER COLUMN "operation_id" SET NOT NULL;

-- lesson_plans: replace global year_group unique with (operation_id, year_group).
ALTER TABLE "lesson_plans" ADD COLUMN "operation_id" TEXT;
UPDATE "lesson_plans" SET "operation_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "lesson_plans" ALTER COLUMN "operation_id" SET NOT NULL;
DROP INDEX "lesson_plans_year_group_key";
CREATE UNIQUE INDEX "lesson_plans_operation_id_year_group_key" ON "lesson_plans"("operation_id", "year_group");

-- pay_periods: replace global (month,year) unique with (operation_id, month, year).
ALTER TABLE "pay_periods" ADD COLUMN "operation_id" TEXT;
UPDATE "pay_periods" SET "operation_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "pay_periods" ALTER COLUMN "operation_id" SET NOT NULL;
DROP INDEX "pay_periods_month_year_key";
CREATE UNIQUE INDEX "pay_periods_operation_id_month_year_key" ON "pay_periods"("operation_id", "month", "year");

-- activity_log: nullable; backfill all existing rows to the default op.
ALTER TABLE "activity_log" ADD COLUMN "operation_id" TEXT;
UPDATE "activity_log" SET "operation_id" = '00000000-0000-0000-0000-000000000001';

-- CreateIndex
CREATE INDEX "users_operation_id_idx" ON "users"("operation_id");
CREATE INDEX "schools_operation_id_idx" ON "schools"("operation_id");
CREATE INDEX "classes_operation_id_idx" ON "classes"("operation_id");
CREATE INDEX "assistants_operation_id_idx" ON "assistants"("operation_id");
CREATE INDEX "topics_operation_id_idx" ON "topics"("operation_id");
CREATE INDEX "pay_periods_operation_id_idx" ON "pay_periods"("operation_id");
CREATE INDEX "activity_log_operation_id_idx" ON "activity_log"("operation_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schools" ADD CONSTRAINT "schools_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assistants" ADD CONSTRAINT "assistants_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topics" ADD CONSTRAINT "topics_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
