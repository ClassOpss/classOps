import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          include: { assistant: { select: { id: true } } },
        });

        // Reject unknown, deactivated, or password-less (invited-but-not-set-up) accounts.
        if (!user || !user.active || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          assistantId: user.assistant?.id ?? null,
          operationId: user.operationId,
        };
      },
    }),
  ],
  events: {
    // Spec 5.1: record a "login" entry in the activity log on every successful sign-in.
    async signIn({ user }) {
      if (!user?.id) return;
      await prisma.activityLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role ?? "assistant",
          action: "login",
          entityType: "user",
          entityId: user.id,
          operationId: user.operationId ?? null,
        },
      });
    },
  },
});
