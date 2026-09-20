-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'quiz_prep';

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "quiz_day" TEXT,
ADD COLUMN     "quiz_start_date" DATE;

-- AlterTable
ALTER TABLE "late_incidents" ADD COLUMN     "quiz_prep_id" TEXT;

-- CreateTable
CREATE TABLE "quiz_preps" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "quiz_date" DATE NOT NULL,
    "quiz_created" BOOLEAN NOT NULL DEFAULT false,
    "sent_to_print" BOOLEAN NOT NULL DEFAULT false,
    "quiz_created_at" TIMESTAMPTZ(6),
    "sent_to_print_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "logged_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_preps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_preps_class_id_idx" ON "quiz_preps"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_preps_class_id_quiz_date_key" ON "quiz_preps"("class_id", "quiz_date");

-- AddForeignKey
ALTER TABLE "quiz_preps" ADD CONSTRAINT "quiz_preps_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_preps" ADD CONSTRAINT "quiz_preps_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_incidents" ADD CONSTRAINT "late_incidents_quiz_prep_id_fkey" FOREIGN KEY ("quiz_prep_id") REFERENCES "quiz_preps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
