-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "max_mark" DROP NOT NULL;

-- AlterTable
ALTER TABLE "quiz_preps" ADD COLUMN     "assessment_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quiz_preps_assessment_id_key" ON "quiz_preps"("assessment_id");

-- AddForeignKey
ALTER TABLE "quiz_preps" ADD CONSTRAINT "quiz_preps_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

