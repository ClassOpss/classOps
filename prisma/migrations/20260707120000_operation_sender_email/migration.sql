-- Per-operation "from" email for invites/notifications (hybrid sender).
ALTER TABLE "operations" ADD COLUMN "sender_email" TEXT;
