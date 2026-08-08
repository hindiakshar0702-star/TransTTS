import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import prisma from "@/lib/prisma";

/**
 * Auth.js v5 (NextAuth) — the single session authority for the app.
 *
 * Google is the only way in. There is no email/password sign-in and no
 * registration form: an account is created the first time someone completes
 * Google sign-in, so there are no passwords to store, reset or leak.
 *
 * Strategy is JWT (no adapter tables): the user lives in the existing Prisma
 * User model. Role + tokenVersion ride on the JWT (see auth.config callbacks);
 * getSessionUser() re-reads the DB for authoritative role/revocation state.
 *
 * Node-only (prisma) — never import this from the edge middleware; the
 * middleware uses auth.config.ts instead.
 */

export const runtime = "nodejs";

/**
 * Test-only sign-in. Google's consent screen cannot be driven from Playwright,
 * so the suite needs some way to reach an authenticated page.
 *
 * This provider takes an email and signs it in WITHOUT ANY VERIFICATION — it is
 * a complete authentication bypass and must never be reachable in production.
 * Two independent conditions gate it: AUTH_TEST_MODE must be "1", and
 * NODE_ENV must not be "production". Mirrors the existing OTP_TEST_MODE gate on
 * /api/auth/otp/test-peek.
 */
const testLoginEnabled =
  process.env.AUTH_TEST_MODE === "1" && process.env.NODE_ENV !== "production";

const testLoginProvider = Credentials({
  id: "test-login",
  name: "Test login",
  credentials: { email: { label: "Email", type: "email" } },
  async authorize(creds) {
    if (!testLoginEnabled) return null;

    const email = typeof creds?.email === "string" ? creds.email.trim().toLowerCase() : "";
    if (!email) return null;

    // emailVerified is left false so the OTP suite can exercise the real
    // verification flow — this provider only proves "there is a session".
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: "Test User", provider: "test" },
      update: {},
      select: { id: true, email: true, name: true, role: true, image: true, provider: true, tokenVersion: true },
    });

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
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      // Auth.js v5's own convention is AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET,
      // which it reads automatically. GOOGLE_CLIENT_ID / _SECRET is the older
      // name this project started with, so both are accepted — passing an
      // undefined-but-present empty string here would otherwise silently
      // override the auto-detected value and Google rejects the request with
      // "Missing required parameter: client_id".
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      // Ask Google to prompt account selection so switching accounts works.
      authorization: { params: { prompt: "select_account" } },
    }),
    ...(testLoginEnabled ? [testLoginProvider] : []),
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
