import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/jwt";

export const runtime = "nodejs";

const STATE_COOKIE = "g_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}

/** fetch with a hard timeout — never hang on the external Google endpoints. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req);
  const loginError = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, base));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return loginError("google_not_configured");

  const url = req.nextUrl;
  if (url.searchParams.get("error")) return loginError("google_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  // Reject missing/forged state (CSRF defense).
  if (!code || !state || !cookieState || state !== cookieState) {
    return loginError("google_state");
  }

  const redirectUri = `${base}/api/auth/google/callback`;

  try {
    // 1. Exchange the authorization code for tokens.
    const tokenRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return loginError("google_token");
    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    if (typeof accessToken !== "string") return loginError("google_token");

    // 2. Fetch the verified profile.
    const infoRes = await fetchWithTimeout("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return loginError("google_userinfo");
    const info = await infoRes.json();

    const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : "";
    const emailVerified = info.email_verified === true || info.email_verified === "true";
    if (!email || !emailVerified) return loginError("google_unverified");

    const name = typeof info.name === "string" ? info.name.slice(0, 80) : null;
    const image = typeof info.picture === "string" ? info.picture : null;

    // 3. Link to an existing account by (verified) email, or create a new one.
    //    Only the avatar is refreshed — a user-edited name is never clobbered,
    //    and an existing credentials account keeps its password.
    const user = await prisma.user.upsert({
      where: { email },
      update: { image: image ?? undefined },
      create: { email, name, image, provider: "google", role: "user" },
      select: { id: true, email: true, name: true, role: true, tokenVersion: true },
    });

    // 4. Open the session on the redirect response itself.
    const token = await signSession({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tv: user.tokenVersion,
    });
    const res = NextResponse.redirect(new URL("/dashboard", base));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return loginError("google_failed");
  }
}
