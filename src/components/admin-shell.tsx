"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";

const BrandMark = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M3 8l9-4 9 4-9 4-9-4Z M7 11v4c0 1 2.2 2 5 2s5-1 5-2v-4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function AdminShell({
  role,
  isAdmin,
  operationName,
  email,
  items,
  signOut,
  children,
}: {
  role: string;
  isAdmin: boolean;
  operationName: string | null;
  email: string;
  items: NavItem[];
  signOut: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg shadow-sm">
          <BrandMark />
        </div>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">ClassOps</p>
          <p className="text-xs capitalize text-faint">{role}</p>
        </div>
      </div>

      {operationName && (
        <div className="mx-3 mb-3 rounded-lg border border-border bg-card-muted px-3 py-2">
          {isAdmin && (
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-faint">Viewing</p>
          )}
          <p className="truncate text-sm font-semibold text-fg">{operationName}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3">
        <SidebarNav items={items} />
      </div>

      <div className="border-t border-border p-3">
        <p className="truncate px-2.5 pb-2 text-xs text-faint">{email}</p>
        <form action={signOut}>
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
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar (lg and up) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <div className={`lg:hidden ${open ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          aria-hidden
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82%] border-r border-border bg-card transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-card-muted hover:text-fg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-fg">
              <BrandMark className="h-4 w-4" />
            </div>
            <p className="font-semibold tracking-tight">ClassOps</p>
          </div>
          {operationName && (
            <span className="ml-auto truncate text-xs font-medium text-faint">{operationName}</span>
          )}
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
