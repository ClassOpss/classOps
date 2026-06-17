-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'teacher', 'assistant');

-- CreateEnum
CREATE TYPE "YearGroup" AS ENUM ('Y9', 'Y10', 'S1', 'shared');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "HwStatus" AS ENUM ('on_time', 'late', 'missing');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('quiz', 'midterm', 'past_paper', 'exam');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('attendance', 'parent_update', 'classroom_upload', 'hw_correction', 'grade_entry');

-- CreateEnum
CREATE TYPE "PayPeriodStatus" AS ENUM ('open', 'finalised', 'sent');

-- CreateEnum
CREATE TYPE "PayCalcStatus" AS ENUM ('pending', 'approved', 'sent');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMPTZ(6),
    "image" TEXT,
    "password_hash" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'assistant',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "year_group" "YearGroup" NOT NULL,
    "name" TEXT NOT NULL,
    "student_count" INTEGER NOT NULL DEFAULT 0,
    "schedule" JSONB NOT NULL,
    "plan_start_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_assignments" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_substitute" BOOLEAN NOT NULL DEFAULT false,
    "substituting_for" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_assistant_assignments" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_assistant_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year_group" "YearGroup" NOT NULL,
    "chapter" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" TEXT NOT NULL,
    "year_group" "YearGroup" NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plan_items" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "topic_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "lesson_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "plan_item_id" TEXT,
    "lesson_number" INTEGER NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "topic_id" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "day_off" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_reason" TEXT,
    "message_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_assignments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "description" TEXT,
    "deadline" DATE NOT NULL,
    "no_homework" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_submissions" (
    "id" TEXT NOT NULL,
    "homework_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "submission_date" DATE,
    "status" "HwStatus" NOT NULL,
    "weak_points" TEXT,
    "logged_by" TEXT NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "logged_by" TEXT NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_update_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "parent_update_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_upload_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "classroom_upload_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "label" TEXT NOT NULL,
    "topic_id" TEXT,
    "topic_notes" TEXT,
    "date" DATE NOT NULL,
    "time" TEXT,
    "max_mark" INTEGER NOT NULL,
    "is_diagnostic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_grades" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "raw_mark" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "logged_by" TEXT NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_hour_sessions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "topic_id" TEXT,
    "topic_notes" TEXT,
    "duration_min" INTEGER,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "office_hour_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "late_incidents" (
    "id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "session_id" TEXT,
    "type" "IncidentType" NOT NULL,
    "deadline" TIMESTAMPTZ(6) NOT NULL,
    "actual_time" TIMESTAMPTZ(6),
    "deduction_amount" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "waive_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayPeriodStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_calculations" (
    "id" TEXT NOT NULL,
    "pay_period_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "classes_covered" INTEGER NOT NULL,
    "base_salary" DECIMAL(10,2) NOT NULL,
    "late_deductions" DECIMAL(10,2) NOT NULL,
    "office_hours_bonus" DECIMAL(10,2) NOT NULL,
    "manual_adjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adjustment_note" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "PayCalcStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "pay_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "class_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_key" ON "auth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_session_token_key" ON "auth_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "classes_school_id_idx" ON "classes"("school_id");

-- CreateIndex
CREATE INDEX "students_class_id_idx" ON "students"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_class_id_code_key" ON "students"("class_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "assistants_user_id_key" ON "assistants"("user_id");

-- CreateIndex
CREATE INDEX "class_assignments_class_id_idx" ON "class_assignments"("class_id");

-- CreateIndex
CREATE INDEX "class_assignments_assistant_id_idx" ON "class_assignments"("assistant_id");

-- CreateIndex
CREATE INDEX "student_assistant_assignments_class_id_idx" ON "student_assistant_assignments"("class_id");

-- CreateIndex
CREATE INDEX "student_assistant_assignments_student_id_idx" ON "student_assistant_assignments"("student_id");

-- CreateIndex
CREATE INDEX "student_assistant_assignments_assistant_id_idx" ON "student_assistant_assignments"("assistant_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_plans_year_group_key" ON "lesson_plans"("year_group");

-- CreateIndex
CREATE INDEX "lesson_plan_items_plan_id_idx" ON "lesson_plan_items"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_plan_items_plan_id_sequence_key" ON "lesson_plan_items"("plan_id", "sequence");

-- CreateIndex
CREATE INDEX "sessions_class_id_idx" ON "sessions"("class_id");

-- CreateIndex
CREATE INDEX "sessions_scheduled_date_idx" ON "sessions"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "homework_assignments_session_id_key" ON "homework_assignments"("session_id");

-- CreateIndex
CREATE INDEX "homework_assignments_class_id_idx" ON "homework_assignments"("class_id");

-- CreateIndex
CREATE INDEX "homework_submissions_homework_id_idx" ON "homework_submissions"("homework_id");

-- CreateIndex
CREATE INDEX "homework_submissions_student_id_idx" ON "homework_submissions"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "homework_submissions_homework_id_student_id_key" ON "homework_submissions"("homework_id", "student_id");

-- CreateIndex
CREATE INDEX "attendance_session_id_idx" ON "attendance"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_session_id_student_id_key" ON "attendance"("session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_update_logs_session_id_key" ON "parent_update_logs"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_upload_logs_session_id_key" ON "classroom_upload_logs"("session_id");

-- CreateIndex
CREATE INDEX "assessments_class_id_idx" ON "assessments"("class_id");

-- CreateIndex
CREATE INDEX "assessment_grades_assessment_id_idx" ON "assessment_grades"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_grades_student_id_idx" ON "assessment_grades"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_grades_assessment_id_student_id_key" ON "assessment_grades"("assessment_id", "student_id");

-- CreateIndex
CREATE INDEX "office_hour_sessions_class_id_idx" ON "office_hour_sessions"("class_id");

-- CreateIndex
CREATE INDEX "office_hour_sessions_assistant_id_idx" ON "office_hour_sessions"("assistant_id");

-- CreateIndex
CREATE INDEX "late_incidents_assistant_id_idx" ON "late_incidents"("assistant_id");

-- CreateIndex
CREATE INDEX "late_incidents_session_id_idx" ON "late_incidents"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_month_year_key" ON "pay_periods"("month", "year");

-- CreateIndex
CREATE INDEX "pay_calculations_assistant_id_idx" ON "pay_calculations"("assistant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_calculations_pay_period_id_assistant_id_key" ON "pay_calculations"("pay_period_id", "assistant_id");

-- CreateIndex
CREATE INDEX "activity_log_class_id_idx" ON "activity_log"("class_id");

-- CreateIndex
CREATE INDEX "activity_log_actor_id_idx" ON "activity_log"("actor_id");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistants" ADD CONSTRAINT "assistants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_substituting_for_fkey" FOREIGN KEY ("substituting_for") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_assistant_assignments" ADD CONSTRAINT "student_assistant_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_assistant_assignments" ADD CONSTRAINT "student_assistant_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_assistant_assignments" ADD CONSTRAINT "student_assistant_assignments_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_items" ADD CONSTRAINT "lesson_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "lesson_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_items" ADD CONSTRAINT "lesson_plan_items_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_plan_item_id_fkey" FOREIGN KEY ("plan_item_id") REFERENCES "lesson_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homework_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_update_logs" ADD CONSTRAINT "parent_update_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_update_logs" ADD CONSTRAINT "parent_update_logs_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_upload_logs" ADD CONSTRAINT "classroom_upload_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_upload_logs" ADD CONSTRAINT "classroom_upload_logs_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hour_sessions" ADD CONSTRAINT "office_hour_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hour_sessions" ADD CONSTRAINT "office_hour_sessions_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hour_sessions" ADD CONSTRAINT "office_hour_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hour_sessions" ADD CONSTRAINT "office_hour_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_incidents" ADD CONSTRAINT "late_incidents_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_incidents" ADD CONSTRAINT "late_incidents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_calculations" ADD CONSTRAINT "pay_calculations_pay_period_id_fkey" FOREIGN KEY ("pay_period_id") REFERENCES "pay_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_calculations" ADD CONSTRAINT "pay_calculations_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
