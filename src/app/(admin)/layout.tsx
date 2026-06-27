import { requireRole } from "@/lib/auth-guards";
import { signOutAction } from "@/actions/auth";
import { currentOperationId, getOperation } from "@/lib/operation";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";

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
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path
                d="M3 8l9-4 9 4-9 4-9-4Z M7 11v4c0 1 2.2 2 5 2s5-1 5-2v-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">ClassOps</p>
            <p className="text-xs capitalize text-faint">{user.role}</p>
          </div>
        </div>

        {operation && (
          <div className="mx-3 mb-3 rounded-lg border border-border bg-card-muted px-3 py-2">
            {isAdmin && <p className="text-[0.65rem] font-medium uppercase tracking-wider text-faint">Viewing</p>}
            <p className="truncate text-sm font-semibold text-fg">{operation.name}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav items={items} />
        </div>

        <div className="border-t border-border p-3">
          <p className="truncate px-2.5 pb-2 text-xs text-faint">{user.email}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[1.05rem] w-[1.05rem]" aria-hidden>
                <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
