import { NextResponse } from "next/server";
import { isPhonePeConfigured, getPhonePeConfig } from "@/lib/phonepe";

export const runtime = "nodejs";

/**
 * GET /api/payment-providers
 *
 * Tells the frontend which payment providers are configured on the
 * server. Used by the upgrade page to decide whether to show a
 * provider toggle and which one to default to.
 *
 * Response:
 *   {
 *     available: ["razorpay", "phonepe"],
 *     default: "razorpay" | "phonepe" | null,
 *     details: {
 *       razorpay: { configured: boolean },
 *       phonepe:  { configured: boolean, env: "UAT" | "PROD", usingTestCreds: boolean }
 *     }
 *   }
 *
 * Never returns secrets — only booleans + the public PhonePe env name.
 */
export async function GET() {
  // Razorpay is "available" only when all three keys exist (server pair + public key).
  const razorpayConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID)
  );

  const phonepeConfigured = isPhonePeConfigured();
  const phonepeCfg = phonepeConfigured ? getPhonePeConfig() : null;

  const available: string[] = [];
  if (razorpayConfigured) available.push("razorpay");
  if (phonepeConfigured) available.push("phonepe");

  const defaultProvider = available[0] ?? null;

  return NextResponse.json({
    available,
    default: defaultProvider,
    details: {
      razorpay: { configured: razorpayConfigured },
      phonepe: {
        configured: phonepeConfigured,
        env: phonepeCfg?.env ?? null,
        usingTestCreds: phonepeCfg ? !phonepeCfg.hasOwnCreds : false,
      },
    },
  });
}
