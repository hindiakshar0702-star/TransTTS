import { randomInt, createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";

/**
 * Shared OTP core — used by BOTH the email and mobile channels (DRY). Handles
 * generation, hashing, cooldown, expiry, and attempt-limited verification.
 * Node-only (node:crypto + prisma) — never import from middleware.
 *
 * Security model:
 *   - The 6-digit code is crypto-random (`randomInt`).
 *   - Only an HMAC-SHA256 of the code (keyed with AUTH_SECRET) is stored; the
 *     plaintext lives only in the email/SMS. A DB leak alone cannot recover it
 *     without the server secret.
 *   - Short TTL + per-target cooldown + max-attempts invalidation bound both
 *     online guessing and resend/SMS-bombing.
 */

export type OtpType = "EMAIL" | "MOBILE";

// Tunables. Mobile keeps the same TTL/attempts but callers apply STRICTER IP
// rate limits at the route layer because SMS costs money.
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

/** Crypto-secure zero-padded 6-digit code. */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (need >= 32 chars).");
  }
  return s;
}

/** Keyed hash of an OTP. Deterministic, so we can look up / compare by hash. */
export function hashOtp(code: string): string {
  return createHmac("sha256", getSecret()).update(code).digest("hex");
}

function hexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// --- Test-only capture ------------------------------------------------------
// When OTP_TEST_MODE=1, the plaintext code is stashed here so e2e tests can read
// it WITHOUT a real provider send and WITHOUT ever leaking it in an API
// response. Guarded hard: unset in prod → the debug route 404s and nothing is
// stored. See src/app/api/auth/otp/_test-peek/route.ts.
const testOtpStore = new Map<string, string>();
export function isOtpTestMode(): boolean {
  return process.env.OTP_TEST_MODE === "1";
}
export function peekTestOtp(type: OtpType, target: string): string | null {
  return testOtpStore.get(`${type}:${target}`) ?? null;
}

export interface CreateOtpResult {
  ok: boolean;
  /** Plaintext code — returned ONLY to the server-side caller for sending. */
  code?: string;
  /** Seconds the caller must wait before another send (cooldown active). */
  cooldown?: number;
}

/**
 * Issue a fresh OTP for (userId, type). Enforces resend cooldown, then replaces
 * any previous code for that pair. Returns the plaintext code for the caller to
 * deliver — it is never persisted or logged here.
 */
export async function createOtp(params: {
  userId: string;
  type: OtpType;
  target: string;
  cooldownMs?: number;
  ttlMs?: number;
}): Promise<CreateOtpResult> {
  const { userId, type, target } = params;
  const cooldownMs = params.cooldownMs ?? OTP_RESEND_COOLDOWN_MS;
  const ttlMs = params.ttlMs ?? OTP_TTL_MS;

  const last = await prisma.otpCode.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const elapsed = Date.now() - last.createdAt.getTime();
    if (elapsed < cooldownMs) {
      return { ok: false, cooldown: Math.ceil((cooldownMs - elapsed) / 1000) };
    }
  }

  // One live code per (user, type): drop the old before minting a new one.
  await prisma.otpCode.deleteMany({ where: { userId, type } });

  const code = generateOtp();
  await prisma.otpCode.create({
    data: { userId, type, target, otpHash: hashOtp(code), expiresAt: new Date(Date.now() + ttlMs) },
  });

  if (isOtpTestMode()) testOtpStore.set(`${type}:${target}`, code);
  return { ok: true, code };
}

export type OtpFailReason = "no_code" | "expired" | "too_many_attempts" | "invalid";

export interface VerifyOtpResult {
  ok: boolean;
  reason?: OtpFailReason;
  /** Attempts left before lockout (only on reason === "invalid"). */
  remaining?: number;
}

/**
 * Verify a submitted code against the latest unused OTP for (userId, type).
 * Expired or attempt-exhausted codes are deleted. A wrong code increments the
 * attempt counter and, once the max is hit, invalidates the code.
 */
export async function verifyOtp(params: {
  userId: string;
  type: OtpType;
  code: string;
  maxAttempts?: number;
}): Promise<VerifyOtpResult> {
  const { userId, type, code } = params;
  const maxAttempts = params.maxAttempts ?? OTP_MAX_ATTEMPTS;

  const rec = await prisma.otpCode.findFirst({
    where: { userId, type, verified: false },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { ok: false, reason: "no_code" };

  if (rec.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.delete({ where: { id: rec.id } });
    return { ok: false, reason: "expired" };
  }
  if (rec.attempts >= maxAttempts) {
    await prisma.otpCode.delete({ where: { id: rec.id } });
    return { ok: false, reason: "too_many_attempts" };
  }

  if (!hexEqual(rec.otpHash, hashOtp(code))) {
    const updated = await prisma.otpCode.update({
      where: { id: rec.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const remaining = maxAttempts - updated.attempts;
    if (remaining <= 0) {
      await prisma.otpCode.delete({ where: { id: rec.id } });
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "invalid", remaining };
  }

  await prisma.otpCode.update({ where: { id: rec.id }, data: { verified: true } });
  return { ok: true };
}
