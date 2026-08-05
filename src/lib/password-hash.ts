import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

/**
 * scrypt password hashing — extracted so it can be imported by BOTH the Auth.js
 * config (src/auth.ts) and the legacy session helpers (src/lib/auth.ts) without
 * a circular import (lib/auth ↔ auth). Node-only.
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
