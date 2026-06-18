import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { signOutAction } from "@/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", adminOnly: false },
  { href: "/lesson-plan", label: "Lesson Plan", adminOnly: false },
  { href: "/progress", label: "Progress", adminOnly: false },
  { href: "/classes", label: "Classes", adminOnly: false },
  { href: "/insights", label: "Insights", adminOnly: false },
  { href: "/pay", label: "Pay", adminOnly: true },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/activity", label: "Activity", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: false },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin + Teacher share this shell; per-link admin-only items are hidden for teachers.
  const user = await requireRole("admin", "teacher");
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-4 dark:border-white/10">
        <div className="mb-4 px-2">
          <p className="font-semibold">ClassOps</p>
          <p className="text-xs text-black/50 capitalize dark:text-white/50">
            {user.role}
          </p>
        </div>
        {NAV.filter((n) => isAdmin || !n.adminOnly).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-md px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            {n.label}
          </Link>
        ))}
        <form action={signOutAction} className="mt-auto pt-4">
          <button
            type="submit"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
