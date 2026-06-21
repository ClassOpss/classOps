# ClassOps — Claude Code Context

## What this is
A multi-user web app for managing a Math IGCSE tutoring operation across multiple schools.
Replaces a Google Sheets system. Three user roles: Admin, Teacher, Assistant.
Full spec: `classops-spec-v2.md` in this folder. Read it for anything not covered here.

---

## Stack
- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL — Railway managed Postgres plugin
- **ORM:** Prisma (with migrations)
- **Auth:** Auth.js v5 (NextAuth) + Prisma adapter — email + password
- **UI:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **PDF:** react-pdf
- **Containerisation:** Docker (Dockerfile for prod, docker-compose for local dev with local Postgres)
- **Deployment:** Railway (Docker deploy + Postgres plugin + cron jobs)
- **PDF parsing:** pdf-parse (text extraction) + Claude API claude-sonnet-4-6 (name extraction from any layout)
- **Batch import:** Prisma `createMany()` for bulk student inserts

---

## User Roles
| Role | Can do |
|---|---|
| **Admin** | Everything. Pay management, user management, all data. |
| **Teacher** | Create/edit lesson plans, topics, assessments. Read-only on all grade/attendance data. Trigger quiz announcements. |
| **Assistant** | Only their assigned classes. Log attendance, parent updates, Classroom uploads, HW submissions, assessment grades, office hours. |

Assistants only see their assigned classes. When a class has 2 assistants, students are split
between them (`student_assistant_assignments` table) — each assistant only sees their sub-group
in HW, grade entry, and office hours. Both see all students for attendance.

---

## Key Business Logic (non-obvious — read carefully)

### Lesson number cascade
Sessions have a `lesson_number` (sequence position) and a `day_off` boolean.
The *displayed* lesson number is computed dynamically: count of non-day-off sessions up to
and including the current one. When `day_off = true`, all subsequent displayed numbers shift
down by 1. No DB writes for the cascade — compute on the fly in queries/components.

### Pay formula
```
total = (classes_covered × 1000)
      - (non_waived_late_incidents × 100)
      + (office_hour_sessions × 100)
      + manual_adjustment
```
All pay multipliers are 1× for now. No exceptions yet.

### Late incident deadlines
| Task | Deadline | Incident type |
|---|---|---|
| Log attendance | 9pm on session day | `attendance` |
| Send parent update | 9pm on session day | `parent_update` |
| Upload to Google Classroom | 9pm on session day | `classroom_upload` |
| Correct HW / enter submission data | 9pm Saturday of that week | `hw_correction` |
| Enter assessment grades | 9pm Saturday of that week | `grade_entry` |

A background cron job fires at 9pm daily and 9pm every Saturday to create `late_incident`
records for missed deadlines. 100 EGP deduction per incident.

### Homework deadline
Auto-set to the date of the next session for that class. Shifts automatically if the next
session is a day-off. Admin or assistant can manually override. Sessions can be marked
"no homework given" — no deadline fires, no missing-submission alerts.

### Grade colour coding
Green/red is **relative to class average for that assessment** — not fixed thresholds.
Compute class average across all submitted grades for the assessment, then:
- Green: student percentage > class average
- Red: student percentage < class average
HW status colours are separate: green = on-time, amber = late, red = missing.

### Past papers (Cambridge)
Assessments with `is_diagnostic = true` are excluded from cumulative student averages
and cross-school topic insights. They appear in grade views but are labelled "Diagnostic".

### WhatsApp messages
Two pre-filled templates — no API sending in v1, just copy-to-clipboard.
1. **Class update** — generated after attendance is submitted for a session.
   Auto-populates: date, class, school, topic, absent students, HW non-submitters,
   new HW description + deadline, upcoming quiz alerts (if assessment within 2 sessions).
2. **Quiz announcement** — triggered by Teacher/Admin when creating an assessment.
   Auto-populates: date, time, topics. Can be sent to multiple classes at once.
Both display in a styled preview panel with a "Copy message" button that flips to
"Copied!" for 2 seconds. After copying: "Mark as sent →" logs the timestamp.

---

## Database Tables (summary)
Full schema with all fields is in `classops-spec-v2.md` Section 4.

| Table | Purpose |
|---|---|
| `schools` | School names |
| `classes` | Class per school + year group + schedule (day/time) |
| `students` | Students per class, with unique code (e.g. C9) |
| `assistants` | Assistant profiles, linked to auth.users |
| `class_assignments` | Assistant ↔ class with date ranges + substitute flag |
| `student_assistant_assignments` | Student ↔ assistant sub-group within a class |
| `topics` | IGCSE syllabus topics, per year group |
| `sessions` | Lesson plan entries (date, topic, lesson_number, day_off) |
| `homework_assignments` | One per session per class, with deadline + no_homework flag |
| `homework_submissions` | Per student per HW: submission date, status, weak points |
| `attendance` | Per student per session: present/absent + logged_at |
| `parent_update_logs` | Per session: sent_at + auto_sent flag |
| `classroom_upload_logs` | Per session: uploaded_at |
| `assessments` | Quiz/midterm/past_paper/exam with max_mark + is_diagnostic |
| `assessment_grades` | Per student per assessment: raw_mark + percentage |
| `office_hour_sessions` | 1-on-1 help sessions: student, assistant, topic, date |
| `late_incidents` | Auto-generated missed deadlines, waiveable by admin |
| `pay_periods` | Monthly pay periods |
| `pay_calculations` | Per assistant per period: base, deductions, bonus, total |
| `activity_log` | Append-only log of every action with actor + timestamp |

---

## Build Order (recommended)
1. Prisma schema (all models) + initial migration + seed script + entrypoint.sh
2. Auth (login, role detection, route protection)
3. Batch import: student PDF upload → Claude API parse → preview table → createMany() insert
   Separate flow: assistant email invite → Auth.js sends setup email → assistant sets password
4. Admin: class + student + assistant management (CRUD)
5. Teacher: lesson plan + day-off cascade + topic management
6. Assistant: attendance logging flow (most critical daily task)
7. Assistant: parent update message generation + copy + mark sent
8. Assistant: Google Classroom upload logging
9. Assistant: homework submission entry
10. Assistant: assessment grade entry
11. Admin: late incident detection (cron) + dashboard alerts
12. Admin: pay calculation + pay period management
13. Admin: office hours logging
14. Insights dashboard (cross-school topic performance, weak points, attendance trends)
15. Monthly report PDF export
16. WhatsApp message templates (class update + quiz announcement)

Build and test each step before moving to the next. Do not scaffold everything at once.

---

## Conventions
- All timestamps stored in UTC, displayed in Cairo local time (Africa/Cairo, UTC+3)
- Student codes are class-scoped (C9 in Y9-Citadel is different from C9 in Y9-Noon)
- `logged_at` fields are always set server-side (`now()`), never trusted from client
- No database-level RLS (that was Supabase). Access control is enforced in server actions and API routes
- Always check session role + class assignment before any data query — assistants must never see other classes or other assistants' data
- Use server components / server actions for all auth-gated data operations — never expose DB queries to the client
- shadcn/ui components throughout — keep UI consistent, don't mix component libraries

---

## Env vars needed
```
# Database
DATABASE_URL=postgresql://user:password@host:5432/classops

# Auth.js
AUTH_SECRET=           # random secret, generate with: openssl rand -base64 32
AUTH_URL=              # full URL of the deployed app e.g. https://classops.up.railway.app

# Cron security
CRON_SECRET=           # shared secret to protect /api/cron/* endpoints
```

## Docker setup
- `Dockerfile` — multi-stage build: deps → build → runner (node:20-alpine)
- `docker-compose.yml` — local dev: app + postgres:16 services
- `prisma/schema.prisma` — single source of truth for DB schema
- `entrypoint.sh` — runs before the Next.js server on every container start:
  ```sh
  #!/bin/sh
  npx prisma migrate deploy   # applies any pending migrations
  exec node .next/standalone/server.js
  ```

## Migrations workflow
- **Locally:** `npx prisma migrate dev --name <description>` → generates migration file in `prisma/migrations/`
- **On Railway:** every deploy rebuilds the image and runs `prisma migrate deploy` via entrypoint — fully automatic
- **Rule:** never edit migration files after they've been committed. Always create a new migration.
- **Seeding:** `prisma/seed.ts` for initial data (topic list, default admin account)

## Railway setup
1. New project → Add service → GitHub repo (or Docker image)
2. Add Postgres plugin → copy DATABASE_URL into app service env vars
3. Set AUTH_SECRET, AUTH_URL, CRON_SECRET env vars
4. Add two cron jobs in Railway:
   - `0 21 * * *` → POST `https://your-app.up.railway.app/api/cron/check-late-incidents` (daily 9pm)
   - `0 21 * * 6` → POST same URL with `{ "weekly": true }` (Saturday 9pm)
   Cron requests must include header `Authorization: Bearer $CRON_SECRET`

---

## Current status
[x] Step 1 — Prisma schema (all models + lesson-plan template), entrypoint.sh, Dockerfile,
    docker-compose.yml, .env, seed (admin + 10 schools + 18 topics), initial migration applied.
    App builds clean. Local Postgres 17 running on localhost:5432.
[x] Step 2 — Auth.js v5 (Credentials + JWT, 7-day) with edge-safe split config (auth.config.ts
    + auth.ts), Prisma adapter, login logs an activity entry. proxy.ts (Next 16 rename of
    middleware) + auth-guards.ts enforce roles: admin=all, teacher=admin area minus
    pay/users/activity, assistant=/my only (admin may view /my). Verified via runtime smoke test.
    Login page + sign-out wired. Dev test accounts: scripts/dev-users.ts.
[x] Step 3 — Batch import + onboarding.
    • Student PDF import: /api/import/parse-pdf (admin-only; pdf-parse v2 -> claude-sonnet-4-6
      name extraction, PDF discarded) + editable preview table + importStudents() (createMany,
      skipDuplicates, name/code dedupe, syncs studentCount). Route guards verified; live
      PDF→names parse NOT yet tested (needs ANTHROPIC_API_KEY + a real class-list PDF).
    • Assistant onboarding: invite (single + bulk) -> VerificationToken -> /set-password
      self-setup. No SMTP in v1 — admin copies the generated link (email send slots in later).
      Verified end-to-end: login blocked pre-setup, succeeds post-setup, token is single-use.
[~] Step 4a — Admin CRUD: schools (create), classes (create/edit/activate with school +
    year group + schedule{day,time} + planStartDate + notes), manual student add/deactivate
    (active-only roster, studentCount synced). Read paths + role guards verified over HTTP
    (admin sees create forms; teacher read-only; assistant blocked). DAYS/YEAR_GROUPS live in
    lib/constants.ts (a "use server" file may only export async fns). Write server actions are
    build-verified but not yet exercised in a live browser request.
[x] Step 4b — assistant↔class assignment (max 2 active/class) + auto-divide students
    (lib/divide.ts: alphabetical halves, first assistant gets the extra; unit-tested).
    Late-imported students auto-assign to the smaller sub-group (hooked into add/import).
    /classes/[id]/assistants UI: assign, end, auto-divide, sub-group view. Verified
    end-to-end in browser (3/2 split; new student → smaller group). Added placeholder
    pages for lesson-plan/insights/activity/settings so the admin sidebar has no dead links.
    Also dropped next/font/google (Geist) -> system fonts so builds need no network.
[~] Step 5a — Teacher topics + lesson-plan authoring. Topic CRUD per year group
    (actions/topics.ts) and the shared per-year-group plan (LessonPlan + ordered
    LessonPlanItem) via actions/lesson-plan.ts (add/remove/reorder; reorder renumbers
    1..n in a transaction with an offset pass to dodge @@unique([planId,sequence])).
    /lesson-plan UI with Y9/Y10/S1 tabs. Verified in-browser (add lessons + reorder).
    Codes: number now uses crypto.getRandomValues (was Math.random); report-order
    anonymity deferred to the reporting step.
[x] Step 5b — generateSessions(classId): materializes per-class ClassSessions from the
    year-group plan + schedule weekday + planStartDate (lib/sessions.ts dates; one per plan
    item, weekly). Regenerate blocked once attendance exists. Day-off mark/clear (admin-only)
    + dynamic lesson numbering (lib/lesson-number.ts) — both unit-tested. /classes/[id]/sessions
    UI. Verified in-browser: 4 weekly Sundays generated; day-off on #2 -> numbers [1,—,2,3].
[x] Step 5c — /progress: cross-class lesson-plan progress (admin+teacher, sidebar link).
    Per class: lessons delivered (non-day-off sessions dated <= today) of total, grouped by
    year group; "Behind by N" relative to the furthest-along class in the cohort, else
    "On track". Verified in-browser (Citadel 6/6 On track; Noon 5/5 Behind by 1 via a day-off).
    Step 5 (Teacher area) complete.
[x] Step 6 — Assistant attendance logging (first assistant-facing flow). /my (assigned
    classes) -> /my/classes/[id] (sessions) -> /my/classes/[id]/attendance/[sessionId]:
    full-class roster, default-present checkboxes, submit (upsert), "Logged at <Cairo>" +
    on-time/late banner. lib/datetime.ts (date-fns-tz): sessionDeadline = 9pm Africa/Cairo on
    the session day; isLate; formatCairo. Assistants only (admin view read-only). NOTE:
    late_incident *records* are deferred to Step 11 (cron) — Step 6 only records + displays
    lateness. Attendance is only loggable once the class has STARTED: sessionStart =
    schedule.time on the session day (Cairo); future sessions show "Upcoming" (no link) and
    the page/action refuse early submits. Verified in-browser: future -> Upcoming/gated,
    today (after start) -> On time, past -> Late; statuses persisted.
[x] Step 7 — Assistant parent-update message. lib/whatsapp/class-update.ts builds Message A
    (date/class/school/topic + absentees BY CODE for privacy; HW/quiz sections omitted until
    Steps 9/10 add that data). /my/classes/[id]/parent-update/[sessionId]: styled preview,
    Copy-to-clipboard (Copied! 2s), Mark-as-sent -> ParentUpdateLog.sentAt with on-time/late vs
    9pm. Gated like attendance (after start, not day-off). Linked from the attendance page.
    Verified in-browser end-to-end (absent C11 in message, copy flip, sent=Late after 9pm).
[x] Step 7b — Class-update message now lists absentees BY NAME (codes are for grade reports
    only; see student-code-privacy). Attendance page gained a "Lesson details" form
    (actions/lesson-details.ts): topic covered (sets session.topicId), homework (description +
    due date, default deadline = next session date; or "no homework" -> HomeworkAssignment),
    and a quiz/announcement note (session.messageNotes). These feed the message and are omitted
    when blank. Verified: message showed name + topic + HW + Due + quiz note.
[x] Step 8 — Google Classroom upload logging. actions/classroom-upload.ts
    markClassroomUploaded -> ClassroomUploadLog.uploadedAt (+ optional notes), gated like the
    other session tasks (after start, not day-off, assistant). "Google Classroom" section on the
    attendance page shows mark button + on-time/late vs 9pm. Build-verified; flow is identical to
    the browser-verified parent-update mark-sent.
[x] Step 9 — Homework submission entry. lib/datetime.saturdayDeadline (9pm Cairo on the
    Sun–Sat week's Saturday) + lib/homework.hwStatus (on_time/late/missing/pending(null)) —
    both unit-tested. actions/homework.submitHomeworkSubmissions: per the assistant's SUB-GROUP
    (getVisibleStudentIds), upsert HomeworkSubmission (submission date + weak points), auto
    status, pending rows skipped. /my/classes/[id]/homework list + /[homeworkId] entry page
    with status badges + on-time/late vs the Saturday deadline. Verified in-browser
    (on_time/late/missing + "Correction logged … On time"). HW assignments come from session
    lesson details (Step 7b). EDIT-AFTER-DEADLINE: loggedAt is set once (create) and never
    bumped on update; correction lateness = the assistant's FIRST entry. So editing after
    Saturday to record a student's own late submission keeps the assistant on-time (verified:
    edited a missing->late student post-Saturday, banner stayed "On time", student became Late).
[x] Step 9b — Completeness gate (accountability). HW entry now requires an EXPLICIT per-student
    choice: "Submitted" (date defaults to due date) or "Not submitted" — no ambiguous blanks.
    A correction is "done" only when ALL sub-group students have a row; until then the page shows
    "Incomplete — N of total reviewed" (never on-time/done). On-time is judged by completion time
    (max first-entry loggedAt, edit-stable). List page shows reviewed/total or "Complete".
    Verified: 1-of-3 entry still Incomplete; 3-of-3 -> "All 3 reviewed … On time".
[x] Step 10 — Assessments + grade entry. actions/assessments.ts create/delete (admin/teacher;
    type/label/date/time/maxMark/topicNotes/isDiagnostic; past_paper auto-diagnostic) +
    /classes/[id]/assessments admin page. actions/assessment-grades.submitGrades: per sub-group,
    rawMark -> percentage, blank=unreviewed, loggedAt create-only. Assistant
    /my/classes/[id]/assessments list + /[assessmentId] entry: client GradeEntryForm with LIVE
    %/colour (green>classAvg, red<, vs server-snapshot avg across ALL students) + live reviewed
    counter; completeness gate + on-time/late vs Saturday deadline. Verified in-browser
    (90/50/70% -> green/red/neutral vs 70% avg; 0/3 Incomplete -> 3/3 On time).
[x] Step 11 — Late-incident detection (cron) + admin dashboard. lib/late-incidents.detectLateIncidents
    (idempotent): daily run -> one incident per active assistant per missed session task
    (attendance/parent_update/classroom_upload, dedupe by assistant+session+type); weekly (Sat)
    run -> hw_correction (per HW due this Sun–Sat week with incomplete sub-group, sessionId set)
    and grade_entry (per assessment this week, sessionId null). /api/cron/check-late-incidents
    (Bearer CRON_SECRET; body {weekly?, date?} — date overrides "now" for testing). lib/roster.ts
    subGroupStudentIds/activeAt. actions/incidents waive/unwaive (admin). Dashboard: stat cards
    (active classes/assistants, sessions this month delivered/planned, open incidents), incidents
    list with waive (reason) + EGP totals, recent activity feed. Verified in-browser + cron curls:
    401 unauth, daily=3, idempotent re-run=0, weekly=2; waive dropped 5/500 -> 4/400 EGP.
[~] Step 12 — Pay periods + calculation. lib/pay.computePayComponents (classesCovered = distinct
    classes with an assignment overlapping the month; base = classes*1000; lateDeductions = sum of
    non-waived incident deductionAmount with deadline in month; officeHoursBonus = office-hour count
    *100). actions/pay: createPayPeriod (generates a PayCalculation per active assistant),
    recalcPayPeriod (refresh after waiving; keeps manual adjustment), setAdjustment, approveCalc,
    sendCalc. /pay (list + open period) and /pay/[periodId] (calc table: base/-deductions/+bonus/
    adjustment/total, approve->send per assistant). Build-verified; browser verification pending in
    the rigorous test pass.
[~] Step 13 — Office hours logging. actions/office-hours.logOfficeHour (assistant, sub-group
    student + date + optional topic/notes/duration -> OfficeHourSession) + deleteOfficeHour.
    /my/classes/[id]/office-hours form + list. +100 EGP bonus already read by lib/pay.
    Build-verified; browser verification in the rigorous test pass.
[~] Step 14 — Insights (admin+teacher). /insights: topic performance bar chart (Recharts,
    client topic-chart.tsx; avg % per topic excl. diagnostics, green>overall avg/red<, ref line),
    attendance rate per class + students with >3 absences flagged, common weak-point keywords
    (tokenised from homework_submissions.weakPoints), assistant activity (incidents, office hours).
    Filters (year group/school/date) deferred. Build-verified; chart runtime check in test pass.
[x] Step 15 — Monthly PDF report. @react-pdf/renderer (serverExternalPackages). lib/reports/
    class-report-data.ts gathers per class+month (sessions w/ display lesson# + attendance rate,
    assessments w/ class avg, student summary BY CODE ordered by code (privacy), homework submission
    rates) + loads public/logos/teacher1.png as a data URI. lib/reports/class-report-doc.tsx
    (Document/Page/Table; logo watermark top-right opacity .5). GET /api/reports/class/[classId]
    ?month=&year= (auth admin/teacher; renderToBuffer -> application/pdf). Download form on the admin
    class overview. Verified: 403 unauth, 200 valid %PDF; extracted text correct (avg 70%, by-code
    rows, 50% attendance/submission). Logo is per-teacher -> becomes the Operation's logo in multi-tenancy.
[x] Step 16 — WhatsApp quiz-announcement (Message B). lib/whatsapp/quiz-announcement.ts:
    buildQuizAnnouncement + friendlyTime (16:00 -> 4:00 PM) + topicsFromNotes (split topicNotes on
    , ; newline into bullets, else topic.title). Per-assessment QuizAnnouncement client (toggle
    preview + copy-to-clipboard) on the /classes/[id]/assessments admin page. Verified builder
    output. NOTE: "Team MO" signature hardcoded -> becomes per-Operation branding in multi-tenancy.
[~] Pre-deploy rework — (1) "Absent" option on assessment grades (committed), (2) multi-slot
    weekly date generator (committed), (3) config centralization: src/lib/config.ts OPERATION_DEFAULTS
    + getConfig() now holds EVERY per-operation tunable (brandName, brandSignature, logoPath,
    currency, timeZone, daily/weekly deadline hour+weekday, perClassSalary, officeHourBonus,
    lateDeduction, payMultiplier). lib/datetime (deadlines/tz), lib/pay (salary/bonus), lib/late-incidents
    (deduction), lib/whatsapp/* (signature), lib/reports (logo path) all read from it. Multi-tenancy
    just makes getConfig() resolve per Operation; the new-teacher form sets these (defaults pre-filled).
[x] Per-day task ownership rework (4 chunks, all committed + browser-verified). DAILY tasks are
    owned per schedule day: lib/responsibility.assignResponsibilities (unit-tested) — 2 assistants
    over multiple weekdays => each weekday owned by one (Tue->A, Thu->B); single weekday => alternate
    by week; day-offs => null. ClassSession gains responsibleAssistantId (stamped at generateSessions,
    re-stamped by reassignResponsibilities on assign/end) + coveredById. lib/schedule (reads new
    {days[]} + legacy {day}); class create/edit now multi-day checkboxes. (1) late-incidents attribute
    a missed daily task to the session OWNER (coveredById ?? responsibleAssistantId), not every
    assistant. (2) assistant /my class view filters sessions into "mine" (owner or unowned) + a
    collapsed "cover a colleague" <details>. (3) COVERAGE: lib/coverage.detectCoverageCandidates flags
    sessions whose daily tasks were logged by a non-owner; admin confirms on the dashboard
    (actions/coverage.confirmCoverage -> coveredById); pay moves +/-coverageAdjustment (config, default
    50) between coverer and owner (lib/pay + PayCalculation.coverageAdjustment column, Coverage column
    on the pay table). Verified end-to-end in-browser: dashboard "Assistant Bee covered Test Assistant"
    -> confirm -> Bee +50/Total 1050, owner -50/Total 950. Seeder: scripts/dev-cov.ts.
[ ] FINAL — Multi-tenancy (logical: Operation table + operationId scoping; per-teacher
    personalization incl. logo) + rigorous test pass, then Railway deploy. See multi-tenancy-decision memory.
[ ] — update this section as modules are completed —

### Notes / deviations from original assumptions
- **Node 24 LTS** (winget); **Prisma pinned to v6** (v7 dropped `url` in schema + needs driver
  adapters — chose stable v6 to match spec/adapter docs). Next 16.2.9 / React 19 / Tailwind v4.
- **Lesson plan = shared template per year group → generated per-class sessions.** New models
  `LessonPlan` + `LessonPlanItem` hold the year-group topic sequence; `ClassSession` rows are
  materialized per class from the schedule + `Class.planStartDate`. The `Session` domain model is
  named `ClassSession` (table `sessions`) to avoid clashing with Auth.js's `Session` model.
- **Student auto-divide** (2 assistants): alphabetical halves, first assistant gets the extra,
  late-imported students go to the smaller group.
- **Teacher extras** beyond spec: cross-class lesson-plan progress view + behind/ahead flag.
- Local dev uses installed Postgres (not Docker); Docker is for the Railway deploy only.
