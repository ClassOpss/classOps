"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode };

const ITEMS: Item[] = [
  {
    href: "/my",
    label: "Classes",
    icon: <path d="M3 7l9-4 9 4-9 4-9-4Zm0 0v6m4-4v5c0 1 2 2 5 2s5-1 5-2v-5" />,
  },
  {
    href: "/my/tasks",
    label: "Tasks",
    icon: <path d="M9 11l3 3 8-8M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />,
  },
  {
    href: "/my/activity",
    label: "Activity",
    icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
];

export function BottomNav({ signOut }: { signOut: ReactNode }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      {ITEMS.map((n) => {
        const active = n.href === "/my" ? pathname === "/my" || pathname.startsWith("/my/classes") : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors ${
              active ? "text-brand" : "text-faint hover:text-muted"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
              {n.icon}
            </svg>
            {n.label}
          </Link>
        );
      })}
      <div className="flex flex-1 flex-col items-center justify-center">{signOut}</div>
    </nav>
  );
}
