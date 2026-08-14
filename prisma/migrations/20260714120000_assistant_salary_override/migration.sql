-- Optional per-assistant per-class rate (seniority); null = operation default.
ALTER TABLE "assistants" ADD COLUMN "per_class_salary" DECIMAL(10,2);
