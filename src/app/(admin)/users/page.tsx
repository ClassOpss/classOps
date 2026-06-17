import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { InviteAssistant } from "./invite-assistant";

export default async function UsersPage() {
  await requireRole("admin");

  const assistants = await prisma.assistant.findMany({
    orderBy: { name: "asc" },
    include: { user: { select: { active: true, passwordHash: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Assistants &amp; Users</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Invite assistants; they set their own password via the link.
        </p>
      </div>

      <InviteAssistant />

      <section>
        <h2 className="mb-3 font-medium">Existing assistants ({assistants.length})</h2>
        {assistants.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">None yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {assistants.map((a) => {
                const pending = !a.user?.passwordHash;
                return (
                  <tr key={a.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2">{a.email}</td>
                    <td className="py-2">
                      {!a.user?.active ? (
                        <span className="text-red-600">Deactivated</span>
                      ) : pending ? (
                        <span className="text-amber-600">Invited (not set up)</span>
                      ) : (
                        <span className="text-green-600">Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
