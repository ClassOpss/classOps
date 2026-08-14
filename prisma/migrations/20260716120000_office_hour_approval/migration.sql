-- Office hours need admin approval before the bonus counts toward pay.
ALTER TABLE "office_hour_sessions" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
-- Existing office hours predate approval — treat them as already approved.
UPDATE "office_hour_sessions" SET "approved" = true;
