import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { InviteAssistant } from "./invite-assistant";

export default async function UsersPage() {
  await requireRole("admin");
  const operationId = await currentOperationId();

  const assistants = await prisma.assistant.findMany({
    where: { operationId },
    orderBy: { name: "asc" },
    include: { user: { select: { active: true, passwordHash: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Assistants &amp; Users</h1>
        <p className="page-subtitle">Invite assistants; they set their own password via the link.</p>
      </div>

      <InviteAssistant />

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Existing assistants ({assistants.length})</h2>
        </div>
        {assistants.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assistants.map((a) => {
                  const pending = !a.user?.passwordHash;
                  return (
                    <tr key={a.id}>
                      <td className="font-medium">{a.name}</td>
                      <td className="text-muted">{a.email}</td>
                      <td>
                        {!a.user?.active ? (
                          <span className="badge-danger">Deactivated</span>
                        ) : pending ? (
                          <span className="badge-warn">Invited (not set up)</span>
                        ) : (
                          <span className="badge-success">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
