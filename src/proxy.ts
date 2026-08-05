import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Route gate (Next 16 `proxy` convention). Auth.js v5 edge middleware: decodes
 * the session JWT (via AUTH_SECRET — no provider/DB needed to READ a session)
 * and runs the `authorized` callback in auth.config.ts, which redirects
 * unauthenticated hits on protected paths to /login?redirect=<path>.
 *
 * Edge runtime: imports only the edge-safe auth.config (no prisma / node crypto).
 */
// Auth.js exposes its middleware as `.auth`; Next 16 wants a function exported
// as default (or named `proxy`). Default-export the wrapper.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Only the authenticated app surfaces. Landing, /login, /contact, and
  // /api/* (Auth.js handles its own) are intentionally excluded.
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/record/:path*",
    "/transcribe/:path*",
    "/translate/:path*",
    "/tts/:path*",
  ],
};
