import { requireRole } from "@/lib/auth-guards";

export default async function SettingsPage() {
  await requireRole("admin", "teacher");
  return (
    <div>
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-black/40 dark:text-white/40">
        App settings land here in a later step.
      </p>
    </div>
  );
}
