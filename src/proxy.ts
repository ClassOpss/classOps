import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import {
  homeFor,
  isAssistantArea,
  pathMatches,
  AUTH_PAGES,
  ADMIN_ONLY_PREFIXES,
} from "@/lib/routes";

// Edge instance — only reads the JWT (authConfig has no Prisma/bcrypt).
const { auth } = NextAuth(authConfig);

// Next 16 "proxy" convention (formerly "middleware").
export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role;

  // API routes enforce their own auth (NextAuth handlers, cron Bearer check).
  if (path.startsWith("/api")) return;

  const onAuthPage = pathMatches(path, AUTH_PAGES);

  // Not logged in -> only auth pages allowed; everything else bounces to /login.
  if (!isLoggedIn) {
    if (onAuthPage) return;
    const url = new URL("/login", nextUrl);
    if (path !== "/") url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // Logged in -> keep them off the login/root pages.
  if (onAuthPage || path === "/") {
    return NextResponse.redirect(new URL(homeFor(role), nextUrl));
  }

  // Assistant area (/my/*): assistants + admin (impersonation). Teacher blocked.
  if (isAssistantArea(path)) {
    if (role === "teacher") {
      return NextResponse.redirect(new URL(homeFor(role), nextUrl));
    }
    return;
  }

  // Admin/Teacher area: assistants are not allowed here.
  if (role === "assistant") {
    return NextResponse.redirect(new URL("/my", nextUrl));
  }

  // Admin-only sub-sections (pay / users / activity): teacher blocked.
  if (role === "teacher" && pathMatches(path, ADMIN_ONLY_PREFIXES)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return;
});

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
