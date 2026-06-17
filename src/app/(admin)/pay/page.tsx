import { requireRole } from "@/lib/auth-guards";

// Admin-only (middleware blocks teachers; guard enforces it server-side too).
export default async function PayPage() {
  await requireRole("admin");

  return (
    <div>
      <h1 className="text-xl font-semibold">Pay</h1>
      <p className="mt-2 text-sm text-black/40 dark:text-white/40">
        Pay periods and calculations land here in a later step.
      </p>
    </div>
  );
}
