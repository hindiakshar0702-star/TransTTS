import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { guard, rateLimit, getClientIp } from "@/lib/api-guard";
import { e164Schema } from "@/lib/phone";
import { createOtp, isOtpTestMode, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";
import { sendSms, otpSms } from "@/lib/sms";

export const runtime = "nodejs";

/**
 * Send a mobile-verification OTP. SMS costs money, so limits are STRICTER than
 * email: per-IP (3/min) AND per-phone (5/hour) on top of the per-user 60s DB
 * cooldown — this blocks SMS-bombing a single number from many IPs. The code is
 * NEVER returned in the response.
 */
export async function POST(req: NextRequest) {
  const ipBlocked = guard(req, "otp-mobile-send-ip", { limit: 3, windowMs: 60_000 });
  if (ipBlocked) return ipBlocked;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const parsed = e164Schema.safeParse((await req.json().catch(() => ({})))?.phone);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const phone = parsed.data;

  // Per-phone cap (independent of IP) — the anti-SMS-bombing control.
  const phoneBlocked = rateLimit(`otp-mobile-phone:${phone}`, 5, 60 * 60_000);
  if (phoneBlocked) return phoneBlocked;
  // Also cap per (IP + phone) pair to catch rotation within limits.
  const pairBlocked = rateLimit(`otp-mobile-pair:${getClientIp(req)}:${phone}`, 5, 60 * 60_000);
  if (pairBlocked) return pairBlocked;

  // Reject a number already tied to a different account.
  const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (owner && owner.id !== user.id) {
    return NextResponse.json({ error: "This phone number is already in use." }, { status: 409 });
  }

  if (user.phone === phone && user.phoneVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // Attach/replace the (unverified) number on this account.
  if (user.phone !== phone || user.phoneVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { phone, phoneVerified: false } });
  }

  // Test-only TTL override (gated on OTP_TEST_MODE); ignored in prod.
  const ttlHeader = req.headers.get("x-otp-test-ttl");
  const ttlMs = isOtpTestMode() && ttlHeader !== null ? Number(ttlHeader) : undefined;

  const result = await createOtp({ userId: user.id, type: "MOBILE", target: phone, ttlMs });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Please wait ${result.cooldown}s before requesting another code.`, cooldown: result.cooldown },
      { status: 429 }
    );
  }

  await sendSms(phone, otpSms(result.code!));

  return NextResponse.json({ ok: true, target: phone, cooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000 });
}
