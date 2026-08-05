import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, bumpTokenVersion } from "@/lib/auth";
import { signOut } from "@/auth";
import { checkOrigin } from "@/lib/api-guard";

export const runtime = "nodejs";

/**
 * "Log out everywhere". Bumps the user's tokenVersion, which invalidates every
 * session issued so far (including on other devices), then clears the cookie on
 * this device too.
 */
export async function POST(req: NextRequest) {
  // CSRF guard: a state-changing request must come from our own pages.
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Bumping tokenVersion invalidates every JWT issued so far (getSessionUser
  // compares tv against the DB), then clear this device's Auth.js cookie.
  await bumpTokenVersion(user.id);
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
