-- Per-class LMS: Google Classroom (default) or IE Learn.
CREATE TYPE "LmsType" AS ENUM ('google_classroom', 'ie_learn');
ALTER TABLE "classes" ADD COLUMN "lms_type" "LmsType" NOT NULL DEFAULT 'google_classroom';
