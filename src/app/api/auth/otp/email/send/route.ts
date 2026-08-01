import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { guard } from "@/lib/api-guard";
import { createOtp, isOtpTestMode, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";
import { sendMail, otpEmail } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * Send a 6-digit email-verification OTP to the signed-in user's own email.
 * The plaintext code is NEVER returned in the response — only delivered by email
 * (or the dev/test transport).
 */
export async function POST(req: NextRequest) {
  // IP rate limit (defense-in-depth on top of the per-user DB cooldown).
  const blocked = guard(req, "otp-email-send", { limit: 5, windowMs: 60_000 });
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // Test-only TTL override (gated on OTP_TEST_MODE) so e2e can exercise the real
  // expiry path without waiting 10 minutes. Ignored in prod.
  const ttlHeader = req.headers.get("x-otp-test-ttl");
  const ttlMs = isOtpTestMode() && ttlHeader !== null ? Number(ttlHeader) : undefined;

  const result = await createOtp({ userId: user.id, type: "EMAIL", target: user.email, ttlMs });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Please wait ${result.cooldown}s before requesting another code.`, cooldown: result.cooldown },
      { status: 429 }
    );
  }

  const body = otpEmail(result.code!);
  // Delivery failure is non-fatal to avoid leaking anything; the user can resend.
  await sendMail({ to: user.email, ...body });

  return NextResponse.json({
    ok: true,
    target: user.email,
    cooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  });
}
