import Link from "next/link";
import { requireRole, requireUser } from "@/lib/auth-guards";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function AccountPage() {
  await requireRole("assistant", "admin");
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/my" className="link text-sm">← Back</Link>
        <h1 className="page-title mt-1">Account</h1>
        <p className="page-subtitle">{user.email}</p>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Change password</h2>
        </div>
        <div className="px-5 py-5">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
