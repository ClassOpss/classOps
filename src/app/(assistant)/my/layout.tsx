import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { signOutAction } from "@/actions/auth";

const NAV = [
  { href: "/my", label: "My Classes" },
  { href: "/my/tasks", label: "Tasks" },
  { href: "/my/activity", label: "Activity" },
];

// Assistant area. Admin is also allowed (read-only impersonation per spec 7).
export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("assistant", "admin");

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 p-4 pb-20">{children}</main>

      {/* Mobile-first bottom nav (spec 7). */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-black/10 bg-background dark:border-white/10">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex-1 py-3 text-center text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            {n.label}
          </Link>
        ))}
        <form action={signOutAction} className="flex-1">
          <button type="submit" className="w-full py-3 text-center text-sm text-red-600">
            Sign out
          </button>
        </form>
      </nav>
    </div>
  );
}
