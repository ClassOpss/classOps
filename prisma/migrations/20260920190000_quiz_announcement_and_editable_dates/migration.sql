-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'quiz_announcement';

-- AlterTable: per-operation quiz task lead times
ALTER TABLE "operations" ADD COLUMN     "quiz_prep_lead_days" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "quiz_announce_lead_days" INTEGER NOT NULL DEFAULT 7;

-- AlterTable: quiz_preps — the cadence date becomes the stable identity (scheduled_date),
-- and a separate editable actual date (quiz_date) is added, defaulting to the scheduled one.
ALTER TABLE "quiz_preps" RENAME COLUMN "quiz_date" TO "scheduled_date";
ALTER TABLE "quiz_preps" ADD COLUMN     "quiz_date" DATE;
UPDATE "quiz_preps" SET "quiz_date" = "scheduled_date";
ALTER TABLE "quiz_preps" ALTER COLUMN "quiz_date" SET NOT NULL;
ALTER TABLE "quiz_preps" ADD COLUMN     "coverage" TEXT;
ALTER TABLE "quiz_preps" ADD COLUMN     "announced_at" TIMESTAMPTZ(6);

-- Re-key the unique constraint onto the stable cadence date.
DROP INDEX "quiz_preps_class_id_quiz_date_key";
CREATE UNIQUE INDEX "quiz_preps_class_id_scheduled_date_key" ON "quiz_preps"("class_id", "scheduled_date");
