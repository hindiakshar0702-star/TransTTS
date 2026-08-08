import prisma from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Node-only auth helpers bridging the app to Auth.js v5. `getSessionUser`
 * reads the Auth.js session (JWT cookie) and re-resolves it to a live DB user,
 * so every existing API route keeps its `getSessionUser()` call unchanged.
 *
 * There is no password hashing here any more: Google is the only sign-in
 * method, so the app stores no credentials. Do NOT import this file (prisma)
 * from the edge middleware — it uses `@/auth.config` instead.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  image: string | null;
  provider: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone: string | null;
}

/**
 * Resolve the current Auth.js session to a live DB user record, or null.
 * Re-reads the user each call so a role/email change or account deletion takes
 * effect immediately (the JWT alone is not trusted for authorization state),
 * and enforces token-version revocation (password reset / "log out everywhere").
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true,
      image: true, provider: true, tokenVersion: true,
      emailVerified: true, phoneVerified: true, phone: true,
    },
  });
  if (!user) return null;

  // Session revocation: a stale token version means the password was reset or
  // the user chose "log out everywhere" after this token was issued. Reject it.
  if ((session.user.tv ?? 0) !== user.tokenVersion) return null;

  const { tokenVersion: _tv, ...safe } = user;
  void _tv;
  return safe;
}

/**
 * Invalidate every existing session for a user (password reset / log-out-all)
 * by bumping the token version. Returns the new version so the caller can mint a
 * fresh session that survives. Node-only (prisma) — never call from middleware.
 */
export async function bumpTokenVersion(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return updated.tokenVersion;
}
