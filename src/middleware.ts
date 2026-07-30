import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";

/**
 * Route gate. Any request to a protected path without a valid session JWT is
 * redirected to /login?redirect=<path>. Runs on the Edge runtime, so it imports
 * only `@/lib/jwt` (jose / Web-Crypto) — never `@/lib/auth` (node scrypt/prisma).
 * This is the real server-side protection; client checks are cosmetic.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Only the authenticated app surfaces. Landing, /login, /contact, and
  // /api/* are intentionally excluded.
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
