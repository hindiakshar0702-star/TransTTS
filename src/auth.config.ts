import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Edge-safe Auth.js v5 config. Imported by BOTH the node runtime (src/auth.ts)
 * and the Edge middleware (src/proxy.ts), so it must NOT import prisma, node
 * crypto, or any provider whose `authorize` touches the DB — those live only in
 * src/auth.ts. Here we keep the pieces the middleware needs: session strategy,
 * the sign-in page, and the route-protection callback.
 */

// App surfaces that require a signed-in user. Mirrors the middleware matcher.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/record",
  "/transcribe",
  "/translate",
  "/tts",
];

export const authConfig = {
  // Trust the deploy host header (needed on Vercel/behind proxies; harmless
  // on localhost). Avoids requiring an explicit AUTH_URL in every environment.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Providers are added in src/auth.ts (node) — Credentials.authorize needs the
  // DB, so it cannot live in this edge-shared file.
  providers: [],
  callbacks: {
    // Gate protected paths at the edge. Unauthenticated hits are redirected to
    // /login?redirect=<path> (same shape the login page already reads).
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      if (!isProtected) return true;
      if (auth?.user) return true;

      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    },
    // Copy identity + role + token-version onto the JWT at sign-in so the
    // session and downstream getSessionUser() can read them without a DB hit
    // in the edge layer. (Revocation is re-checked against the DB in
    // getSessionUser, which runs in the node runtime.)
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
        token.tv = (user as { tv?: number }).tv ?? 0;
        token.provider = (user as { provider?: string }).provider ?? "credentials";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "user";
        (session.user as { tv?: number }).tv = (token.tv as number) ?? 0;
        (session.user as { provider?: string }).provider =
          (token.provider as string) ?? "credentials";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
