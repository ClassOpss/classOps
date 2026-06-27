import { requireRole } from "@/lib/auth-guards";

export default async function ActivityPage() {
  await requireRole("admin");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Activity</h1>
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">The cross-class activity feed lands here in a later step.</p>
      </div>
    </div>
  );
}
