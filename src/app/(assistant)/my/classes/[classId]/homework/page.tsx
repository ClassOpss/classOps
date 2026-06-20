import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { saturdayDeadline, formatCairo } from "@/lib/datetime";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function HomeworkListPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true },
  });

  const homeworks = await prisma.homeworkAssignment.findMany({
    where: { classId, noHomework: false },
    orderBy: { deadline: "desc" },
    select: {
      id: true,
      description: true,
      deadline: true,
      session: { select: { scheduledDate: true } },
      _count: { select: { submissions: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← {klass?.name}</Link>
        <h1 className="mt-1 text-lg font-semibold">Homework</h1>
      </div>

      {homeworks.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No homework assigned yet. Homework is added from a session&apos;s lesson details.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {homeworks.map((hw) => (
            <li key={hw.id}>
              <Link
                href={`/my/classes/${classId}/homework/${hw.id}`}
                className="block rounded-lg border border-black/10 p-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{hw.description ?? "Homework"}</p>
                  <span className="text-sm text-amber-600">
                    {hw._count.submissions > 0 ? "Edit →" : "Enter →"}
                  </span>
                </div>
                <p className="text-sm text-black/50 dark:text-white/50">
                  Due {dateFmt.format(hw.deadline)} · enter by {formatCairo(saturdayDeadline(hw.deadline), "EEE d MMM, h:mm a")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
