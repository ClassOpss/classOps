-- AlterTable
ALTER TABLE "assessment_grades" ADD COLUMN     "absent" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "raw_mark" DROP NOT NULL,
ALTER COLUMN "percentage" DROP NOT NULL;
