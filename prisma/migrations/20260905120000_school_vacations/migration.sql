-- School vacations (Easter, mid-year, …) + vacation proration column on pay calculations.

-- CreateTable
CREATE TABLE "school_vacations" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_vacations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_vacations_operation_id_idx" ON "school_vacations"("operation_id");

-- CreateIndex
CREATE INDEX "school_vacations_school_id_idx" ON "school_vacations"("school_id");

-- AddForeignKey
ALTER TABLE "school_vacations" ADD CONSTRAINT "school_vacations_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_vacations" ADD CONSTRAINT "school_vacations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "pay_calculations" ADD COLUMN "vacation_deduction" DECIMAL(10,2) NOT NULL DEFAULT 0;
