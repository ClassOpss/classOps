import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config: NO providers, NO Prisma, NO bcrypt here.
// Used both by the full Node auth instance (src/auth.ts) and the edge middleware.
// Role/assistantId are copied from the authorized user into the JWT at sign-in,
// so the token already carries them on every later request (no DB call needed).
export const authConfig = {
  // Behind Railway's proxy (and for `next start` locally) we trust the host header.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (spec 5.1)
  },
  providers: [], // real providers added in src/auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.assistantId = user.assistantId ?? null;
        token.operationId = user.operationId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = token.role as Role;
        session.user.assistantId = (token.assistantId as string | null) ?? null;
        session.user.operationId = (token.operationId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
