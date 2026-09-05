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
  callbacks: {
    ...authConfig.callbacks,
    // Node-runtime override of the edge jwt callback (auth.config.ts). Same sign-in
    // enrichment, PLUS a self-heal: if an assistant's profile was linked or their
    // account set up AFTER this token was minted (e.g. they held a 7-day session
    // while being invited/assigned), the token would carry assistantId=null and /my
    // would wrongly show "no assistant profile" until a manual sign-out/in. Re-resolve
    // it from the DB on the next request instead. One query only until it's healed.
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.assistantId = user.assistantId ?? null;
        token.operationId = user.operationId ?? null;
      }
      if (token.uid && token.role === "assistant" && !token.assistantId) {
        const a = await prisma.assistant.findUnique({
          where: { userId: token.uid as string },
          select: { id: true },
        });
        if (a) token.assistantId = a.id;
      }
      return token;
    },
  },
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
