import { NextRequest, NextResponse } from "next/server";
import { isOtpTestMode, peekTestOtp, type OtpType } from "@/lib/otp";

export const runtime = "nodejs";

/**
 * TEST-ONLY: returns the last plaintext OTP for a target so e2e tests can verify
 * without a real email/SMS provider. Hard-gated on OTP_TEST_MODE=1 — in any other
 * environment this responds 404 and reveals nothing. NOT a production endpoint.
 * (Folder must not be underscore-prefixed — Next treats those as non-routable.)
 */
export async function GET(req: NextRequest) {
  if (!isOtpTestMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const type = req.nextUrl.searchParams.get("type") as OtpType | null;
  const target = req.nextUrl.searchParams.get("target");
  if ((type !== "EMAIL" && type !== "MOBILE") || !target) {
    return NextResponse.json({ error: "type and target required" }, { status: 400 });
  }
  return NextResponse.json({ code: peekTestOtp(type, target) });
}
