-- AlterTable
ALTER TABLE "parent_report_notes" ADD COLUMN     "hide_trend" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "hw_feedback" DROP NOT NULL;
