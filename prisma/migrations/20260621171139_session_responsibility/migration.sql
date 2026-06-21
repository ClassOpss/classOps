-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "covered_by_id" TEXT,
ADD COLUMN     "responsible_assistant_id" TEXT;

-- CreateIndex
CREATE INDEX "sessions_responsible_assistant_id_idx" ON "sessions"("responsible_assistant_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_responsible_assistant_id_fkey" FOREIGN KEY ("responsible_assistant_id") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_covered_by_id_fkey" FOREIGN KEY ("covered_by_id") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
