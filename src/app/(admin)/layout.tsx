import { requireRole } from "@/lib/auth-guards";
import { signOutAction } from "@/actions/auth";
import { currentOperationId, getOperation } from "@/lib/operation";
import { type NavItem } from "@/components/sidebar-nav";
import { AdminShell } from "@/components/admin-shell";

const NAV: (NavItem & { adminOnly: boolean })[] = [
  { href: "/dashboard", label: "Dashboard", adminOnly: false },
  { href: "/lesson-plan", label: "Lesson Plan", adminOnly: false },
  { href: "/progress", label: "Progress", adminOnly: false },
  { href: "/classes", label: "Classes", adminOnly: false },
  { href: "/insights", label: "Insights", adminOnly: false },
  { href: "/pay", label: "Pay", adminOnly: true },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/activity", label: "Activity", adminOnly: true },
  { href: "/operations", label: "Operations", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: false },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin + Teacher share this shell; per-link admin-only items are hidden for teachers.
  const user = await requireRole("admin", "teacher");
  const isAdmin = user.role === "admin";
  const operation = await getOperation(await currentOperationId());
  const items = NAV.filter((n) => isAdmin || !n.adminOnly);

  return (
    <AdminShell
      role={user.role}
      isAdmin={isAdmin}
      operationName={operation?.name ?? null}
      email={user.email ?? ""}
      items={items}
      signOut={signOutAction}
    >
      {children}
    </AdminShell>
  );
}
