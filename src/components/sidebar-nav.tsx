"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string };

// Minimal inline icon set (no extra deps). Keyed by href.
const ICONS: Record<string, ReactNode> = {
  "/dashboard": (
    <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
  ),
  "/lesson-plan": (
    <path d="M4 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-2 1V4Zm3 4h8M7 11h8" />
  ),
  "/progress": <path d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" />,
  "/classes": (
    <path d="M3 7l9-4 9 4-9 4-9-4Zm0 0v6m4-4v5c0 1 2 2 5 2s5-1 5-2v-5" />
  ),
  "/insights": <path d="M21 21H4a1 1 0 0 1-1-1V3m4 13 4-5 3 3 5-7" />,
  "/pay": (
    <path d="M3 6h18v12H3V6Zm0 4h18M7 14h2m8 0h.01" />
  ),
  "/users": (
    <path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
  ),
  "/activity": <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  "/operations": (
    <path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z" />
  ),
  "/settings": (
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3l-.4-2.5H9.7l-.4 2.5a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1c.7.5 1.4 1 2.2 1.3l.4 2.5h4.6l.4-2.5c.8-.3 1.5-.8 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z" />
  ),
  "/my": <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />,
};

function Icon({ href }: { href: string }) {
  const key = Object.keys(ICONS).find((k) => href === k) ?? href;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.05rem] w-[1.05rem] shrink-0"
      aria-hidden
    >
      {ICONS[key] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              active
                ? "bg-brand-soft font-semibold text-brand-softfg"
                : "font-medium text-muted hover:bg-card-muted hover:text-fg"
            }`}
          >
            <span className={active ? "text-brand" : "text-faint group-hover:text-muted"}>
              <Icon href={n.href} />
            </span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
