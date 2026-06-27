import { requireRole } from "@/lib/auth-guards";

export default async function SettingsPage() {
  await requireRole("admin", "teacher");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Settings</h1>
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">App settings land here in a later step.</p>
      </div>
    </div>
  );
}
