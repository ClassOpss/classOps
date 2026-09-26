-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'monthly_report';

-- CreateTable
CREATE TABLE "parent_report_logs" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sent_by_id" TEXT,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_report_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_report_logs_student_id_year_month_key" ON "parent_report_logs"("student_id", "year", "month");

-- AddForeignKey
ALTER TABLE "parent_report_logs" ADD CONSTRAINT "parent_report_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_report_logs" ADD CONSTRAINT "parent_report_logs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
