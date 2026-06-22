import type { Role } from "@prisma/client";

// Pure route helpers — safe to import from edge middleware (no runtime deps).

// Where each role lands after login.
export function homeFor(role?: Role | string | null): string {
  return role === "assistant" ? "/my" : "/dashboard";
}

// Admin-only sections within the admin/teacher area (teacher is blocked from these).
// /operations is the super-admin's tenant switcher + teacher onboarding.
export const ADMIN_ONLY_PREFIXES = ["/pay", "/users", "/activity", "/operations"];

// Unauthenticated-accessible pages.
export const AUTH_PAGES = ["/login", "/set-password", "/reset-password"];

export function pathMatches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export function isAssistantArea(path: string): boolean {
  return path === "/my" || path.startsWith("/my/");
}
