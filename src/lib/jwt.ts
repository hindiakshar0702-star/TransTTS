import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe session JWT helpers. This module imports ONLY `jose` (Web-Crypto
 * based) so it can run in the Next.js middleware (Edge runtime). Password
 * hashing (node:crypto scrypt) lives in `@/lib/auth`, which is node-only —
 * never import that from middleware.
 */

export interface SessionPayload {
  sub: string; // user id
  email: string;
  role: string; // "user" | "admin"
  name?: string | null;
  tv?: number; // tokenVersion — see User.tokenVersion (session revocation)
}

const ALG = "HS256";
export const SESSION_COOKIE = "transtts_session";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need >= 32 chars). Add it to .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    name: payload.name ?? null,
    tv: payload.tv ?? 0,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      name: typeof payload.name === "string" ? payload.name : null,
      tv: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}
