import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { signSession, verifySession, SESSION_COOKIE, type SessionPayload } from "@/lib/jwt";

/**
 * Node-only auth helpers: password hashing (scrypt) + session cookie
 * management + current-user lookup. Do NOT import this from middleware
 * (scrypt / prisma are not Edge-safe) — use `@/lib/jwt` there instead.
 */

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** Hash a password as `salt:derivedKey`, both hex. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time verify against a `salt:derivedKey` string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  const keyBuf = Buffer.from(key, "hex");
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(keyBuf, derived);
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Sign a session JWT and set it as an httpOnly cookie. */
export async function createUserSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Remove the session cookie (logout). */
export async function clearUserSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

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
 * Resolve the current session to a live DB user record, or null. Re-reads the
 * user each call so a role/email change or account deletion takes effect
 * immediately (the JWT alone is not trusted for authorization state).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true, email: true, name: true, role: true,
      image: true, provider: true, tokenVersion: true,
      emailVerified: true, phoneVerified: true, phone: true,
    },
  });
  if (!user) return null;

  // Session revocation: a stale token version means the password was reset or
  // the user chose "log out everywhere" after this token was issued. Reject it.
  if ((payload.tv ?? 0) !== user.tokenVersion) return null;

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
