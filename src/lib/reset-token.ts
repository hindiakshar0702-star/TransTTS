import { randomBytes, createHash } from "crypto";

/**
 * Password-reset token helpers. The RAW token is sent only in the emailed link;
 * only its SHA-256 hash is stored in the DB, so a database leak cannot be used
 * to reset passwords. Node-only (node:crypto) — never import from middleware.
 */

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Generate a fresh reset token: returns the raw token (for the link) + its hash (for the DB). */
export function newResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

/** Deterministic hash of a raw token, for DB lookup. */
export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
