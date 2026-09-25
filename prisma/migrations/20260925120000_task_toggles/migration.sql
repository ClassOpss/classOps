-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "disabled_tasks" "IncidentType"[] DEFAULT ARRAY[]::"IncidentType"[];

-- AlterTable
ALTER TABLE "class_assignments" ADD COLUMN     "exempt_tasks" "IncidentType"[] DEFAULT ARRAY[]::"IncidentType"[];
