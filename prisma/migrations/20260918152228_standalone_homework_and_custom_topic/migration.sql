-- AlterTable
ALTER TABLE "homework_assignments" ALTER COLUMN "session_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "late_incidents" ADD COLUMN     "homework_id" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "custom_topic" TEXT;

-- AddForeignKey
ALTER TABLE "late_incidents" ADD CONSTRAINT "late_incidents_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homework_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
