# ClassOps — Product Requirements Document
### Math IGCSE Operations Management App
**Version:** 2.0 (Final Pre-Build)
**Author:** Jana (Head of Assistants)
**Status:** All questions resolved. Ready for Claude Code.

---

## 1. Project Overview

A multi-user web application to manage a Math IGCSE tutoring operation across multiple schools and classes. Replaces a fragmented Google Sheets system. Three user roles: Admin, Teacher, and Assistant.

**Core problems solved:**
- No reliable record of when each assistant did what → replaced by automatic timestamping of all actions
- Pay calculation was manual and inaccurate → auto-calculated from logged incidents
- Lesson plan broke on holidays (manual renumbering) → day-off cascade handles this automatically
- Monthly reports took hours → one-click PDF export
- Cross-school grade insights required manual work → built-in analytics dashboard
- Parent update messages were manually written every session → auto-generated from live session data and auto-sent via WhatsApp

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | Full-stack in one repo, React-based |
| Database | PostgreSQL (Railway managed Postgres) | Self-contained, no third-party lock-in |
| ORM | Prisma | Type-safe queries, excellent migration tooling |
| Auth | Auth.js v5 (NextAuth) + Prisma adapter | Email + password, role-based, works directly with Postgres |
| Containerisation | Docker (Dockerfile + docker-compose for local dev) | Consistent environment, clean Railway deploy |
| Deployment | Railway | Native Docker support, managed Postgres plugin, cron jobs |
| Background jobs | Railway cron → internal API endpoint | Hits `/api/cron/check-late-incidents` at 9pm daily and 9pm Saturday |
| UI | Tailwind CSS + shadcn/ui | Fast to build, clean, accessible |
| PDF export | react-pdf | Monthly reports |
| Charts | Recharts | Insights dashboard |
| WhatsApp sending | Clipboard copy (v1) | Pre-filled message, copy to clipboard. WhatsApp Business API auto-send deferred to v2. |

---

## 3. User Roles

### 3.1 Admin (Jana)
Full access to everything. The only role that can manage pay, resolve disputes, and send pay slips.

Permissions: all of Teacher + all of Assistant + pay management + user management + activity logs across all users + delete/edit any record.

### 3.2 Teacher
The math teacher. Sets the academic structure at the start of the year and monitors class performance.

Permissions:
- Create and modify lesson plans (year-group level: Y9, Y10, S1)
- Create and modify topics/syllabus
- Create assessments (quizzes, midterms, papers, exams) and trigger quiz announcements
- View all class performance insights and analytics
- View all attendance and grade data (read-only)
- Cannot manage assistant pay, activity logs, or user accounts

### 3.3 Assistant
One login per assistant. Sees only their assigned classes.

Permissions:
- Log attendance for their assigned class sessions
- Mark parent update as sent
- Log Google Classroom material upload as complete
- Enter homework submission data for their assigned students
- Enter assessment grades for their assigned students
- Log office hour sessions
- View their own activity log and current month's pay status

---

## 4. Data Model

### 4.1 Schools
```
schools
  id         uuid PK
  name       text  — e.g. "Citadel", "Noon", "Summits", "Eschola",
                        "Glory", "Center", "BICC", "Manchester", "Gulf", "BMS"
  created_at timestamp
```

### 4.2 Classes
```
classes
  id            uuid PK
  school_id     uuid FK → schools
  year_group    text       — "Y9" | "Y10" | "S1"
  name          text       — e.g. "Y9-Citadel", "Y9-4-Summits"
  student_count int
  schedule      jsonb      — { day: "Sunday", time: "16:00" }
                             Each class has its own schedule day and start time.
                             Used for late detection (9pm deadline on day of session).
  active        boolean
  notes         text
  created_at    timestamp
```

### 4.3 Students
```
students
  id         uuid PK
  class_id   uuid FK → classes
  name       text       — full name
  code       text       — class-unique code e.g. "C9", "C28"
  active     boolean
  created_at timestamp
```

### 4.4 Assistants
```
assistants
  id         uuid PK
  user_id    uuid FK → auth.users
  name       text
  email      text
  phone      text
  active     boolean
  created_at timestamp
```

### 4.5 Class–Assistant Assignments
Tracks which assistant is responsible for which class and for which time period.
Supports mid-year changes (e.g. Farah → Kareem on Y10-Citadel after week 1).

```
class_assignments
  id                uuid PK
  class_id          uuid FK → classes
  assistant_id      uuid FK → assistants
  start_date        date
  end_date          date       — null = currently active
  is_substitute     boolean    — true if covering someone else temporarily
  substituting_for  uuid FK → assistants (nullable)
  notes             text
  created_at        timestamp
```

### 4.6 Student–Assistant Sub-Assignments
When a class has 2 assistants, students are divided between them. Each assistant is responsible
for their sub-group: tracking grades, knowing weaknesses, answering questions, correcting HW.
Attendance is taken for the full class together by whoever logs it first.

```
student_assistant_assignments
  id           uuid PK
  class_id     uuid FK → classes
  student_id   uuid FK → students
  assistant_id uuid FK → assistants
  start_date   date
  end_date     date  — null = currently active
  created_at   timestamp
```

### 4.7 Topics (Syllabus)
Predefined list of IGCSE Math topics. Created and managed by Teacher or Admin.

```
topics
  id         uuid PK
  title      text       — e.g. "Probability & Statistics", "Algebraic Fractions"
  year_group text       — "Y9" | "Y10" | "S1" | "shared"
  chapter    text       — optional grouping
  sort_order int
```

### 4.8 Sessions (Lesson Plan)
The master schedule. Created by Teacher at start of year. One session = one class meeting.

```
sessions
  id                  uuid PK
  class_id            uuid FK → classes
  lesson_number       int        — sequence position in the plan (used for cascade logic)
  scheduled_date      date
  topic_id            uuid FK → topics
  status              enum: scheduled | completed | cancelled
  day_off             boolean    — if true, date is skipped, lesson number not counted in display
  cancellation_reason text       — e.g. "National holiday", "Ramadan"
  created_at          timestamp
```

**Lesson number display logic (cascade):**
Lesson numbers are computed dynamically. The `lesson_number` field stores the intended
sequence position. The *displayed* lesson number = count of non-day-off sessions up to and
including this one. When a session is marked `day_off = true`, all subsequent sessions'
displayed numbers shift down by 1 in real time, with no database writes needed.
Topics always stay in their original order regardless of day-offs.

**Shared plan with per-class pace overrides:**
The Teacher creates one plan per year group (Y9 plan, Y10 plan, S1 plan). All classes of
that year group inherit it. If a specific class runs at a different pace, the admin can
override individual sessions for that class (different topic, different date) without
affecting the shared plan.

### 4.9 Homework Assignments
One per session per class. Created by Teacher/Admin. Can be set to "no homework given"
for sessions where no work was assigned.

```
homework_assignments
  id              uuid PK
  session_id      uuid FK → sessions
  class_id        uuid FK → classes
  description     text       — what the homework is
  deadline        date       — auto-set to date of next session; manually overridable
  no_homework     boolean    — if true, no HW was given this session (no submissions expected)
  created_at      timestamp
```

**Deadline logic:**
- Default: the date of the immediately following session for that class
- If the following session is a day-off, deadline shifts to the one after that
- Admin or assistant can manually override the deadline
- If `no_homework = true`, no deadline applies and no missing submission alerts fire

### 4.10 Homework Submissions
Per student per homework assignment. Filled in by the student's assigned assistant.

```
homework_submissions
  id              uuid PK
  homework_id     uuid FK → homework_assignments
  student_id      uuid FK → students
  submission_date date       — the date the student submitted; null = not submitted
  status          enum: on_time | late | missing  — auto-calculated (see logic below)
  weak_points     text       — assistant notes what the student struggled with
  logged_by       uuid FK → assistants
  logged_at       timestamp
```

**Status auto-logic:**
- `submission_date` is not null AND `submission_date <= deadline` → `on_time`
- `submission_date` is not null AND `submission_date > deadline` → `late`
- `submission_date` is null AND current date > deadline → `missing`
- `submission_date` is null AND current date <= deadline → pending (not yet a status)

### 4.11 Attendance Records
```
attendance
  id          uuid PK
  session_id  uuid FK → sessions
  student_id  uuid FK → students
  status      enum: present | absent
  logged_by   uuid FK → assistants
  logged_at   timestamp   — auto-set on submit; key for late detection
  notes       text        — optional
```

### 4.12 Parent Update Logs
One record per session per class. Assistant marks sent after copying/sending the WhatsApp message.

```
parent_update_logs
  id           uuid PK
  session_id   uuid FK → sessions
  assistant_id uuid FK → assistants
  sent_at      timestamp   — auto-set on mark-as-sent; key for late detection
  auto_sent    boolean     — reserved for v2 WhatsApp Business API auto-send; always false in v1
```

### 4.13 Google Classroom Upload Logs
Assistant marks material as uploaded to Google Classroom after each session.

```
classroom_upload_logs
  id           uuid PK
  session_id   uuid FK → sessions
  assistant_id uuid FK → assistants
  uploaded_at  timestamp   — auto-set; key for late detection
  notes        text        — optional description of what was uploaded
```

### 4.14 Assessments
Created by Teacher or Admin. Types: quiz, midterm, past_paper, exam.
Past papers are diagnostic only — not included in cumulative grade averages.

```
assessments
  id           uuid PK
  class_id     uuid FK → classes
  type         enum: quiz | midterm | past_paper | exam
  label        text       — e.g. "Quiz 11", "Midterm 2", "May/June 2017 P1 V1"
  topic_id     uuid FK → topics (nullable — for multi-topic assessments, use topic_notes)
  topic_notes  text       — e.g. "Probability & Interpreting Data"
  date         date
  time         time       — needed for quiz announcement message
  max_mark     int
  is_diagnostic boolean   — true for past papers; excluded from cumulative averages
  created_at   timestamp
```

### 4.15 Assessment Grades
Per student per assessment. Filled in by the student's assigned assistant.

```
assessment_grades
  id            uuid PK
  assessment_id uuid FK → assessments
  student_id    uuid FK → students
  raw_mark      decimal
  percentage    decimal  — auto-calculated: (raw_mark / max_mark) * 100
  logged_by     uuid FK → assistants
  logged_at     timestamp
```

**Grade colour coding (relative to class average — NOT fixed thresholds):**
- For each assessment, compute the class average percentage across all submitted grades
- Green: student's percentage > class average
- Red: student's percentage < class average
- No amber needed for grades

**Cumulative averages exclude `is_diagnostic = true` assessments (past papers).**

### 4.16 Office Hour Sessions
When a student needs extra help, their assigned assistant meets them during break time.
This is a pay bonus event (+100 EGP per session logged).

```
office_hour_sessions
  id           uuid PK
  class_id     uuid FK → classes
  assistant_id uuid FK → assistants
  student_id   uuid FK → students
  date         date
  topic_id     uuid FK → topics (nullable)
  topic_notes  text       — free text if topic not in list
  duration_min int        — optional, for reference
  logged_at    timestamp
```

### 4.17 Late Incidents
Auto-generated by the system when a deadline is missed. Each incident type has its own record.

```
late_incidents
  id               uuid PK
  assistant_id     uuid FK → assistants
  session_id       uuid FK → sessions (nullable — for weekly tasks, session may not apply)
  type             enum: attendance | parent_update | classroom_upload | hw_correction | grade_entry
  deadline         timestamp  — the 9pm cutoff that was missed
  actual_time      timestamp  — when the action was eventually taken (null if still outstanding)
  deduction_amount decimal    — default 100 EGP per incident
  waived           boolean    — admin can waive a deduction
  waive_reason     text
  created_at       timestamp
```

### 4.18 Pay Periods
```
pay_periods
  id         uuid PK
  month      int
  year       int
  status     enum: open | finalised | sent
  created_at timestamp
```

### 4.19 Pay Calculations
One record per assistant per pay period. Auto-generated; admin reviews and approves.

```
pay_calculations
  id                uuid PK
  pay_period_id     uuid FK → pay_periods
  assistant_id      uuid FK → assistants
  classes_covered   int        — number of classes this assistant covered this month
  base_salary       decimal    — classes_covered × 1000 EGP (see Section 5.9)
  late_deductions   decimal    — sum of non-waived late_incidents.deduction_amount for this period
  office_hours_bonus decimal   — count of office_hour_sessions × 100 EGP
  manual_adjustment decimal    — admin can add/subtract with a note
  adjustment_note   text
  total             decimal    — base_salary - late_deductions + office_hours_bonus + manual_adjustment
  status            enum: pending | approved | sent
  sent_at           timestamp
```

### 4.20 Activity Log
Append-only. Every significant action in the system.

```
activity_log
  id          uuid PK
  actor_id    uuid
  actor_role  text       — "admin" | "teacher" | "assistant"
  action      text       — e.g. "logged_attendance", "submitted_hw_grades", "marked_parent_update"
  entity_type text       — e.g. "session", "homework_assignment", "assessment"
  entity_id   uuid
  class_id    uuid FK → classes (denormalised for fast filtering)
  metadata    jsonb
  created_at  timestamp
```

---

## 5. Feature Specifications

### 5.1 Authentication & Login Tracking
- Email + password login via Auth.js v5 (NextAuth) with Prisma adapter
- On every login: record timestamp in `activity_log` with action `"login"`
- Login time is a data point available to admin (does not trigger a late incident on its own)
- Password reset via email
- Session tokens expire after 7 days
- Admin can deactivate any account

### 5.2 Lesson Plan Manager (Teacher / Admin)

**Year setup (Teacher):**
1. Create topics (or use predefined list)
2. Create sessions for each year group: date + topic for each session
3. All classes of that year group inherit the plan automatically
4. Teacher or Admin can override individual sessions per class (different topic or date)

**Day-off handling (key feature — Admin only):**
- Admin marks any session as `day_off = true` with a reason
- That session is greyed out in the timeline and excluded from lesson numbering
- All subsequent sessions' displayed lesson numbers shift down by 1 in real time (no DB writes)
- A confirmation shows: "X sessions renumbered" after marking a day-off
- HW deadlines that were tied to the cancelled session auto-shift to the next valid session
- Day-off is fully reversible (restore = numbers shift back, deadlines restore)

**Homework assignment:**
- Admin/Teacher can mark "no HW given" for any session
- Default deadline auto-set to the next session's date
- Admin or assistant can manually override the deadline per assignment
- If a day-off falls between the session and the deadline, deadline auto-shifts past the day-off

### 5.3 Student Sub-Assignment (Admin)
When a class has 2 assistants, admin splits the student roster between them.

- Admin opens a class → "Assign students to assistants" tab
- Drag/drop or checkbox-assign each student to Assistant A or Assistant B
- Stored as `student_assistant_assignments`
- This assignment drives: which students an assistant sees in HW entry, grade entry, and office hours
- Attendance: all students shown to both assistants (either can log it)
- Sub-assignments can be changed at any time; history is preserved with start/end dates

### 5.4 Attendance Logging (Assistant)
1. Assistant opens their class → Sessions tab
2. Selects today's session (or most recent incomplete one)
3. Student roster shown — marks each: Present / Absent
4. Hits "Submit" → `logged_at = now()` saved
5. System checks: is `logged_at` before 9pm on the session's scheduled day?
   - Yes → no incident
   - No → `late_incident` record created (type: `attendance`)
6. After attendance submitted → prompt to log parent update (see 5.5)

**Admin/Teacher view:**
- Grid: rows = students, columns = sessions
- Green cell = present, red = absent, grey = not yet logged
- Per-session attendance rate shown
- Missing logs flagged in dashboard

### 5.5 Parent Update Logging (Assistant)
After each session, assistant sends the WhatsApp class update and marks it done in the app.

**Flow:**
1. Assistant submits attendance → app immediately generates the pre-filled class update message
2. A "Copy message" button appears in the UI with the full message ready
3. Assistant copies → opens WhatsApp → pastes → sends to class group
4. Returns to app → clicks "Mark as sent" → `sent_at = now()` recorded

**Late detection:**
- `sent_at` must be before 9pm on the session's scheduled day
- If not: `late_incident` created (type: `parent_update`)

**Message template:** See Section 5.13 for the full template and auto-populated fields.

### 5.6 Google Classroom Upload Logging (Assistant)
After each session, assistant uploads materials (notes, corrections, videos) to Google Classroom
and marks it as done in the app.

- Simple checkbox: "Material uploaded to Google Classroom" → saves `uploaded_at = now()`
- Deadline: 9pm on session day
- If not marked by 9pm: `late_incident` created (type: `classroom_upload`)
- Admin can see upload log per session

### 5.7 Homework Tracking (Assistant)
Assistant logs submission data for their sub-group of students.

**Entry flow:**
1. Open class → Homework tab
2. Select homework assignment (shows description + deadline)
3. Per student in their sub-group:
   - Enter submission date (date picker) — or mark "not submitted"
   - Enter weak points (text field — what did this student struggle with)
4. Status auto-calculated on entry: On-time / Late / Missing
5. Submit → `logged_at = now()`

**Late detection:**
- All HW grade entries must be submitted before 9pm on Saturday of the week the homework was due
- If not: `late_incident` created (type: `hw_correction`)

**Admin/Teacher view:**
- Grid: rows = students, columns = homework assignments
- Per cell: status badge (On-time green / Late amber / Missing red) + date
- Weak points visible in cell tooltip or click-through
- Class-wide weak points summary available in Insights

### 5.8 Assessment Grade Entry (Assistant)
Assistant enters grades for their sub-group of students after a quiz, midterm, or exam.

**Entry flow:**
1. Open class → Assessments tab
2. Select assessment (shows type, date, max mark, topic)
3. Per student in their sub-group: enter raw mark
4. Percentage auto-calculated and shown in real time
5. Colour coding shown immediately (relative to current average as marks are entered)
6. Submit → `logged_at = now()`

**Late detection:**
- Quiz/midterm grades must be submitted before 9pm on Saturday of the week of the assessment
- If not: `late_incident` created (type: `grade_entry`)

**Admin/Teacher view:**
- Grid: rows = students, columns = assessments
- Per cell: raw mark / percentage, colour-coded (green = above class avg, red = below)
- Class average shown per assessment column
- Student average shown per student row (excluding `is_diagnostic` assessments)

### 5.9 Pay Calculation

**Base salary (multi-class rule):**
The fairest approach for assistants covering multiple classes is pay-per-class:
> **Base salary = number of active classes covered this month × 1,000 EGP**

Example: Farah covers 4 classes in February → base = 4,000 EGP.
The logic: each class is a distinct workload (attendance, HW correction, updates, grades).
Admin can override per assistant if a class is a lighter commitment (e.g. very small class).

All pay multipliers are 1× for now. Section will be updated once this year's class
and assistant assignments are finalised.

**Deductions:**
- 100 EGP per non-waived `late_incident`, regardless of type
- All incident types are logged separately but each costs 100 EGP

**Bonuses:**
- +100 EGP per logged `office_hour_session`

**Formula:**
```
total = (classes_covered × 1000)
      - (non_waived_late_incidents × 100)
      + (office_hour_sessions × 100)
      + manual_adjustment
```

**Monthly pay flow (Admin):**
1. At month end: admin opens/creates the pay period
2. System auto-generates one `pay_calculation` per assistant with all fields populated
3. Admin reviews each line:
   - Can waive any late incident with a note
   - Can add manual adjustment (positive or negative) with a note
4. Admin clicks "Approve" per assistant, then "Send"
5. Sent timestamp recorded; pay slip generated

**Pay slip (generated on send):**
- Month, assistant name, classes covered (listed), session count
- Base salary breakdown (X classes × 1,000 EGP)
- Itemised late deductions (date, type, session)
- Office hours bonus (count × 100 EGP)
- Manual adjustment + note (if any)
- Total
- Formatted for WhatsApp or PDF

### 5.10 Late Incident Detection (Automatic)

**Deadlines by task type:**
| Task | Deadline | Incident type |
|---|---|---|
| Log attendance | 9pm on day of session | `attendance` |
| Send parent update | 9pm on day of session | `parent_update` |
| Upload to Google Classroom | 9pm on day of session | `classroom_upload` |
| Correct HW / enter submission data | 9pm on Saturday of that week | `hw_correction` |
| Enter assessment grades | 9pm on Saturday of that week | `grade_entry` |

**System behaviour:**
- A background job (cron) runs at 9pm every day and every Saturday
- Checks all outstanding tasks (sessions with no attendance log, HW with missing entries, etc.)
- Creates `late_incident` records for each missed deadline
- Admin sees these as alerts in the dashboard
- Admin can waive any incident before the pay period is finalised
- Assistant can see their own late incidents and their current month's deduction total

**Session time dependency:**
Each class in `classes.schedule` stores the day and start time (e.g. Sunday at 4pm).
The 9pm deadline applies to the session's scheduled day, not the current day.
If a class is on Sunday at 4pm, the attendance deadline is Sunday at 9pm.

### 5.11 Office Hours Logging (Assistant)
```
Log entry: date / student / topic / assistant / duration (optional)
Pay effect: +100 EGP per logged session (no limit)
```

1. Assistant opens class → Office Hours tab
2. Fills in: student (dropdown from their sub-group), topic (from topic list or free text), date, optional duration
3. Submit → logged with timestamp
4. Admin sees all office hours per class/assistant/student
5. Automatically added to pay calculation for the month

### 5.12 Admin Dashboard
**Stat cards:**
- Active classes | Active assistants | Sessions completed this month / planned | Pay status (X of Y sent)

**Alerts (prioritised, colour-coded):**
- Red: overdue attendance log (session was >2h ago, nothing logged)
- Red: overdue parent update (9pm passed, session not updated)
- Red: overdue classroom upload (9pm passed, not marked)
- Amber: HW correction deadline approaching (Saturday is tomorrow, grades not yet entered)
- Amber: Assessment grades not entered (1 week after quiz, still missing)
- Blue: Upcoming quiz in 2 sessions — check announcement was sent
- Blue: Pay period open — N assistants pending approval
Each alert links directly to the relevant class/session.

**Class status table:**
- Per class: name, assistant(s), last session date, attendance status, HW status, grade entry status

**Recent activity feed:**
- Last 20 actions across all classes with actor + timestamp

### 5.13 WhatsApp Message Generation (v1: copy-paste; v2: auto-send)

**v1 approach (current):**
The app generates both message types fully pre-filled with live data and displays them
with a one-click "Copy message" button. The assistant or admin pastes into the WhatsApp
group and sends manually, then marks the task as done in the app (which records the timestamp).

**v2 note:** Jana has a WhatsApp Business account. Full auto-send via WhatsApp Business API
can be added in v2 with minimal changes to the data model (just a `whatsapp_group_id` field
per class and an API call replacing the copy button).

---

**Message A — Class Update (generated after each session)**

Triggered: when assistant opens the "Parent update" task for a session.
All fields auto-populated from live session/class data.
Assistant reviews, copies, sends in WhatsApp, then clicks "Mark as sent" in app.

```
*Class Update – [session.date formatted DD Month YYYY]*
Dear Parents,
Today, in class [class.name] – [school.name] we covered:
Topic: [session.topic.title]

*Attendance:*
Absent students: [comma-separated names of students marked absent]

*Homework:*
Students who did not submit previous homework: [names with status "missing" from last session's HW]
New homework assigned: [homework_assignment.description]
Due: [homework_assignment.deadline formatted as DD Month YYYY]

*Class Notes/Reminders:*
[if assessment within next 2 sessions: "Upcoming quiz on [date] covering [topics]"]
[any manual notes added to this session by admin/teacher — editable free text field]

Thank you for your continued support.
Best regards,
*Team MO*
```

**Message B — Quiz Announcement (generated before an assessment)**

Triggered: Teacher or Admin clicks "Send announcement" on an assessment, or from the
assessment creation flow. Can be sent to one class or multiple classes at once (for shared
assessments across year groups).

```
*Quiz Announcement*
Good Afternoon Parents & Students,
Just a quick reminder that we'll be having a quiz on [assessment.date] at [assessment.time].
It will cover:
- [topic line 1]
- [topic line 2]
...
The quiz will be short and focused, so students are encouraged to revise their
notes, homework, and correction videos.
Always feel free to share any questions or concerns, we're always here!
We'll also share results in the monthly report so you can track progress.
Best of luck to everyone!
*Team MO*
```

Topics are pulled from `assessment.topic_notes` (free text) or `assessment.topic_id` — whichever
is filled. If multiple topics, each appears on its own line prefixed with a dash.

**UI detail:**
Both messages display in a styled preview panel with a prominent "Copy message" button.
On copy, button changes to "Copied!" for 2 seconds. Beneath the preview: "Mark as sent →"
button which logs the timestamp. Both buttons are present; assistant can re-copy if needed
before marking as sent.

### 5.16 Batch Import

#### A — Student import from PDF (Admin)
Schools provide class lists as PDFs. Formats vary per school so a fixed parser won't work.

**Flow:**
1. Admin opens a class → Students tab → "Import students from PDF"
2. Uploads PDF file
3. Server extracts raw text with `pdf-parse`
4. Raw text sent to Claude API (claude-sonnet-4-6) with prompt:
   `"Extract a list of student full names from this text. Return only a JSON array of strings, nothing else."`
5. Response parsed into a list of names
6. Admin sees a **preview table**: name (editable), student code (auto-suggested as C1, C2…, editable), action (remove row)
7. Admin reviews, edits any mistakes, removes duplicates
8. Clicks "Import X students" → `prisma.student.createMany({ skipDuplicates: true })`
9. Success summary: "14 students added, 2 skipped (already exist)"

**Notes:**
- Student codes are auto-suggested sequentially but admin can change any
- Duplicate detection is by name within the same class (case-insensitive)
- If Claude API parse fails or returns garbage, admin falls back to a manual entry form
- PDF file is not stored — only the parsed names are kept

#### B — Assistant account creation (Admin)
Assistants are fewer (9–15) so no PDF needed. Admin creates accounts one at a time or via email list.

**Single creation:**
Admin enters name + email → app creates Auth.js account → sends password setup email to the assistant
→ assistant clicks link, sets their own password → account active.

**Bulk invite (email list):**
Admin pastes a list of emails (one per line) → app sends setup emails to all → assistants self-onboard.
Each account is created with role `assistant` and no class assignments yet.
Admin then assigns classes separately (Section 4.5 class_assignments).

### 5.14 Insights Dashboard (Admin / Teacher)

**Cross-school topic performance:**
- For each topic: bar chart showing average assessment score (%) per class/school
- Colours: green bar = above class average, red bar = below class average
- Topics where multiple classes score poorly are flagged with a warning
- Filterable by: year group, topic, school, date range
- Excludes diagnostic (past paper) assessments from averages

**Weak points aggregation:**
- From `homework_submissions.weak_points` free text
- Most commonly mentioned keywords/topics across all students and classes
- Surfaced per class and across all classes

**Student-level grade trend:**
- Per class: line chart of each student's assessment scores over time
- Identify students consistently below class average

**Attendance trends:**
- Per class: attendance rate over the year
- Students with >3 absences flagged

**Assistant performance metrics:**
- On-time logging rate per task type
- Sessions covered / total assigned
- HW corrections submitted on time rate
- Office hours sessions count per month

### 5.15 Monthly Report Export (Admin / Teacher)
One-click PDF per class per month. Content:
- Class + school + assistant + year group
- Session log: lesson numbers, dates, topics, attendance rates
- Homework summary: submission rate per assignment, most common weak points
- Assessment results: grade table (raw + %), class average per assessment
- Student summary: each student's overall average (excluding diagnostics), absence count
- Design: clean table layout matching what parents/teacher are used to seeing

---

## 6. Workflows

### 6.1 Year Setup (Teacher + Admin — done once per year)
1. **Teacher:** Create/update topic list for Y9, Y10, S1
2. **Teacher:** Create session plan for each year group (lesson number, date, topic)
3. **Admin:** Create schools (if new) and classes (link to school, year group, schedule day/time, WhatsApp number)
4. **Admin:** Add students to each class (name + student code)
5. **Admin:** Create assistants and their login accounts
6. **Admin:** Assign assistants to classes (start date, date range if known)
7. **Admin:** For classes with 2 assistants — assign students to each assistant
8. **Admin:** Set HW deadlines (or confirm auto-calculated ones)
9. **Teacher:** Create assessments as they're scheduled during the year

### 6.2 Admin — Daily/Weekly
- Login → check Dashboard alerts
- Review and waive any auto-generated late incidents
- Confirm or adjust day-offs in the lesson plan when national holidays are announced
- Monitor pending tasks per class

### 6.3 Admin — End of Month
1. Open the pay period
2. Review auto-generated pay calculations per assistant
3. Waive any incidents if appropriate (with note)
4. Add manual adjustments if needed
5. Approve and send each assistant's pay slip
6. Export monthly PDF reports per class

### 6.4 Teacher — Session Prep
1. Check upcoming sessions → confirm topics are correct
2. If rescheduling needed → mark day-off in lesson plan → verify cascade
3. If a quiz is coming up → create assessment → trigger quiz announcement to relevant classes

### 6.5 Assistant — Day of Session
1. Login (timestamp recorded)
2. Select class → open today's session
3. Mark attendance per student → Submit (timestamp recorded)
4. Review auto-generated parent update message → copy to clipboard → send in WhatsApp → mark as sent in app
5. Upload materials to Google Classroom → mark uploaded in app (timestamp recorded)
6. All 3 tasks must be done before 9pm or late incident fires

### 6.6 Assistant — Weekend (HW correction)
1. Login
2. Select class → Homework tab
3. Open homework assignment(s) for the past week
4. For each student in their sub-group: enter submission date + weak points
5. Submit before 9pm Saturday or late incident fires

### 6.7 Assistant — After Assessment
1. Login
2. Select class → Assessments tab
3. Select the quiz/midterm/exam
4. Enter raw mark per student in their sub-group
5. Submit before 9pm Saturday of that week or late incident fires

### 6.8 Assistant — Office Hours
1. Student requests help during break
2. After the session: open class → Office Hours tab
3. Log: student, topic, date
4. Submit → +100 EGP added to their month's bonus

---

## 7. UI / UX Requirements

### General
- Web app, no install, accessible from browser
- Deployed on Railway via Docker — accessible at a Railway-provided URL (or custom domain)
- Admin/Teacher view: desktop-optimised (grids, dashboards, reports)
- Assistant view: **mobile-optimised** — large tap targets, minimal scrolling, quick flows
- English language

### Colour system (consistent everywhere)
- Green: present / on-time / above average
- Amber: late / borderline
- Red: absent / missing / below average
- Grey: not yet logged / pending
- Blue: informational / upcoming

### Navigation
- **Admin/Teacher sidebar:** Dashboard / Lesson Plan / Classes / Insights / Pay / Settings
- **Assistant bottom nav (mobile):** My Classes / Tasks / Activity
- Admin can view any assistant's perspective by impersonating their view (read-only)

### Key UX rules
- Every submission shows "Logged at [time]" feedback to assistant — makes accountability tangible
- Attendance, HW, and grade grids visually match the familiar sheet layout assistants already know
- Lesson plan day-off preview: before confirming a day-off, show which lesson numbers will change
- Dashboard alerts always link directly to the specific class/session that needs attention (1 click to fix)
- Mobile assistant flows must complete in ≤ 3 taps for core actions (attendance submit, parent update confirm)
- Assessments: percentage and colour update in real time as assistant types raw marks (before submit)

---

## 8. Decisions Made (All Questions Resolved)

| # | Question | Decision |
|---|---|---|
| 1 | Column G in template | Not needed in app. Was for dividing students between 2 assistants during setup — now handled by student sub-assignment feature. |
| 2 | Pay for multi-class assistants | 1,000 EGP per class per month. Pay multipliers all 1× for now — to revisit once this year's classes and assistants are confirmed. |
| 3 | What counts as "late" | Daily tasks (attendance, parent update, Classroom upload): 9pm on session day. Weekly tasks (HW correction, grade entry): 9pm Saturday. Each task type logged as a separate incident, all cost 100 EGP. |
| 4 | Grade colour thresholds | Dynamic: green = above class average for that assessment, red = below. No fixed percentage. No amber for grades (HW status has its own green/amber/red for on-time/late/missing). |
| 5 | HW deadline | Auto-set to date of next session. Shifts if next session is a day-off. Manually overridable by admin or assistant. "No HW given" option available per session. |
| 6 | Lesson plan scope | Shared per year group (Y9, Y10, S1), with per-class pace overrides possible. |
| 7 | Teacher role | Yes — new role. Can create/modify lesson plans, topics, assessments, trigger quiz announcements. Read-only access to all grade/attendance data. Cannot manage pay or users. |
| 8 | Office hours | Logged per student per session. +100 EGP pay bonus per session. Logs: date, student, topic, assistant. |
| 9 | WhatsApp sending | Copy-paste in v1. App generates both message templates fully pre-filled. One-click copy → assistant sends manually in WhatsApp → marks done in app. WhatsApp Business API auto-send in v2 (account already exists). |
| 10 | Google Classroom upload | Separate daily task. Log as done with timestamp. 9pm deadline same as other daily tasks. |
| 11 | Statistics (S1) classes | Same structure as Y9/Y10. No differences. |
| 12 | Past papers (Cambridge) | Diagnostic only. Included in grade views but excluded from cumulative student averages. |

---

## 9. Out of Scope for v1

- Student-facing login
- WhatsApp auto-sending (v1 is copy-paste; WhatsApp Business API integration is v2)
- Google Classroom API integration (assistants upload manually and log it as done in the app)
- Historical data migration from last year's sheets (fresh start)
- Storing uploaded PDF files (only the parsed names are kept; PDFs are discarded after parsing)
- Multi-teacher / multi-operation support
- Mobile native app (responsive web is sufficient)
- WhatsApp group management (numbers are added manually by admin per class)

---

*End of spec v2. All open questions resolved. Hand this document to Claude Code to begin implementation.*
