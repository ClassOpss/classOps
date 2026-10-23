-- CreateTable
CREATE TABLE "assessment_correctors" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "set_by" TEXT,
    "set_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_correctors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_correctors_assessment_id_idx" ON "assessment_correctors"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_correctors_assessment_id_student_id_key" ON "assessment_correctors"("assessment_id", "student_id");

-- AddForeignKey
ALTER TABLE "assessment_correctors" ADD CONSTRAINT "assessment_correctors_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_correctors" ADD CONSTRAINT "assessment_correctors_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_correctors" ADD CONSTRAINT "assessment_correctors_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_correctors" ADD CONSTRAINT "assessment_correctors_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
