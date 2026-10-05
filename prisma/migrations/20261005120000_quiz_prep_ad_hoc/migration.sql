-- Hand-added assessments get their own announcement + prep tasks (off the biweekly cadence).
ALTER TABLE "quiz_preps" ADD COLUMN "ad_hoc" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: upcoming assessments with no quiz tasks yet, on a day with no quiz row.
INSERT INTO "quiz_preps" ("id", "class_id", "scheduled_date", "quiz_date", "coverage", "assessment_id", "ad_hoc")
SELECT gen_random_uuid()::text, a."class_id", a."date", a."date", a."topic_notes", a."id", true
FROM "assessments" a
WHERE a."date" >= CURRENT_DATE
  AND NOT EXISTS (SELECT 1 FROM "quiz_preps" q WHERE q."assessment_id" = a."id")
  AND NOT EXISTS (
    SELECT 1 FROM "quiz_preps" q
    WHERE q."class_id" = a."class_id" AND (q."scheduled_date" = a."date" OR q."quiz_date" = a."date")
  )
ON CONFLICT DO NOTHING;
