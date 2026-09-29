-- Quiz announcement lead time: 7 days -> 5 days before the quiz.
ALTER TABLE "operations" ALTER COLUMN "quiz_announce_lead_days" SET DEFAULT 5;

-- Move operations still on the old default; custom values set in Settings are kept.
UPDATE "operations" SET "quiz_announce_lead_days" = 5 WHERE "quiz_announce_lead_days" = 7;
