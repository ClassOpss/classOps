-- Student contact details (for Classroom invites + WhatsApp link sends).
ALTER TABLE "students" ADD COLUMN "email" TEXT;
ALTER TABLE "students" ADD COLUMN "phone" TEXT;
ALTER TABLE "students" ADD COLUMN "parent_name" TEXT;
ALTER TABLE "students" ADD COLUMN "parent_phone" TEXT;

-- Per-class onboarding destinations (invite links pasted once).
ALTER TABLE "classes" ADD COLUMN "google_classroom_link" TEXT;
ALTER TABLE "classes" ADD COLUMN "student_group_link" TEXT;
ALTER TABLE "classes" ADD COLUMN "parent_community_link" TEXT;
