"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

// Attendance is taken for the WHOLE class (spec 4.6) by whichever assistant logs first.
// Checkboxes named "present" carry the present student ids; everyone else is absent.
export async function submitAttendance(sessionId: string, formData: FormData): Promise<void> {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true },
  });
  if (!session) return;

  const user = await requireClassAccess(session.classId);
  if (!user.assistantId) return; // only assistants log attendance (admin view is read-only)

  const students = await prisma.student.findMany({
    where: { classId: session.classId, active: true },
    select: { id: true },
  });
  const present = new Set(formData.getAll("present").map(String));
  const now = new Date();
  const loggedById = user.assistantId;

  await prisma.$transaction(
    students.map((s) =>
      prisma.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: s.id } },
        update: { status: present.has(s.id) ? "present" : "absent", loggedById, loggedAt: now },
        create: {
          sessionId,
          studentId: s.id,
          status: present.has(s.id) ? "present" : "absent",
          loggedById,
          loggedAt: now,
        },
      }),
    ),
  );

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "logged_attendance",
    entityType: "session",
    entityId: sessionId,
    classId: session.classId,
    metadata: { present: present.size, total: students.length },
  });

  revalidatePath(`/my/classes/${session.classId}/attendance/${sessionId}`);
  revalidatePath(`/my/classes/${session.classId}`);
}
