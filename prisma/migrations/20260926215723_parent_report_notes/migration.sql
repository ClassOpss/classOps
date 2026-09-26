-- CreateTable
CREATE TABLE "parent_report_notes" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "hw_feedback" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_report_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_report_notes_student_id_year_month_key" ON "parent_report_notes"("student_id", "year", "month");

-- AddForeignKey
ALTER TABLE "parent_report_notes" ADD CONSTRAINT "parent_report_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
