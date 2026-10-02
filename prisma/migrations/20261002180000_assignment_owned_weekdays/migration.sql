-- Admin-picked weekdays an assistant owns the daily tasks for (empty = automatic split).
ALTER TABLE "class_assignments" ADD COLUMN "owned_weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
