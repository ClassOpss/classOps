import type { Prisma } from "@prisma/client";

// Attendance rows that count toward attendance rates. "excused" (e.g. a known
// schedule clash) is left out of both sides, so it never lowers a student's rate.
export const COUNTED_ATTENDANCE = {
  status: { in: ["present", "absent"] },
} satisfies Prisma.AttendanceWhereInput;
