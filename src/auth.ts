import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/password-hash";

/**
 * Auth.js v5 (NextAuth) — the single session authority for the app.
 *
 * Providers:
 *   - Google OAuth (client id/secret from env).
 *   - Credentials (email + password), verified against the existing
 *     User.passwordHash via the project's scrypt helper. No password logic is
 *     duplicated — Auth.js just drives the flow.
 *
 * Strategy is JWT (no adapter tables): the user lives in the existing Prisma
 * User model. Role + tokenVersion ride on the JWT (see auth.config callbacks);
 * getSessionUser() re-reads the DB for authoritative role/revocation state.
 *
 * Node-only (prisma + scrypt) — never import this from the edge middleware;
 * the middleware uses auth.config.ts instead.
 */

export const runtime = "nodejs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Ask Google to prompt account selection so switching accounts works.
      authorization: { params: { prompt: "select_account" } },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = typeof creds?.email === "string" ? creds.email.trim().toLowerCase() : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, name: true, role: true, image: true,
            provider: true, passwordHash: true, tokenVersion: true,
          },
        });
        // No local password (e.g. Google-only account) → reject credentials login.
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Shape handed to the jwt() callback as `user`.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          provider: user.provider,
          tv: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google sign-in: upsert the User row so the rest of the app (jobs, profile,
    // roles) has a real record. Email-verified is trusted from Google.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      // Only allow verified Google emails.
      if (profile && profile.email_verified === false) return false;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, tokenVersion: true, provider: true },
      });

      if (!existing) {
        const created = await prisma.user.create({
          data: {
            email,
            name: user.name ?? null,
            image: user.image ?? null,
            provider: "google",
            emailVerified: true,
          },
          select: { id: true, role: true, tokenVersion: true, provider: true },
        });
        user.id = created.id;
        (user as { role?: string }).role = created.role;
        (user as { tv?: number }).tv = created.tokenVersion;
        (user as { provider?: string }).provider = "google";
      } else {
        user.id = existing.id;
        (user as { role?: string }).role = existing.role;
        (user as { tv?: number }).tv = existing.tokenVersion;
        (user as { provider?: string }).provider = existing.provider;
      }
      return true;
    },
  },
});
