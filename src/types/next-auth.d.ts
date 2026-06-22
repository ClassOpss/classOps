import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augment Auth.js types with our domain fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      assistantId: string | null;
      // null = super-admin (cross-operation); otherwise the user's home operation.
      operationId: string | null;
    } & DefaultSession["user"];
  }

  // Returned by `authorize` and passed to the jwt callback as `user`.
  interface User {
    role: Role;
    assistantId?: string | null;
    operationId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    assistantId?: string | null;
    operationId?: string | null;
  }
}
