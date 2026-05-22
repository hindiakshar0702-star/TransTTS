import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getOrderAmountInPaise,
  isValidPlan,
  isValidCycle,
  PLAN_NAMES,
} from "@/lib/razorpay";
import {
  getPhonePeConfig,
  generateMerchantTransactionId,
  encodePayload,
  computeXVerifyForPay,
} from "@/lib/phonepe";

export const runtime = "nodejs";

const PAY_PATH = "/pg/v1/pay";

/**
 * Resolve the public base URL of this deployment, used to build
 * redirect/callback URLs that PhonePe will hit. Order of preference:
 *   1. NEXT_PUBLIC_APP_URL env (explicit)
 *   2. x-forwarded-* headers (Vercel)
 *   3. request URL origin
 */
function resolveAppUrl(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    new URL(req.url).protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

/**
 * POST /api/phonepe/create-order
 *
 * Body: { plan, cycle, name, email, phone? }
 * Returns: { redirectUrl, orderId, merchantTransactionId }
 *
 * Frontend MUST set window.location.href = redirectUrl (full-page redirect).
 * PhonePe will POST back to /api/phonepe/callback after the user completes
 * (or cancels) payment.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { plan, cycle, name, email, phone } = body as {
      plan?: string;
      cycle?: string;
      name?: string;
      email?: string;
      phone?: string;
    };

    if (!plan || !isValidPlan(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'starter', 'pro' or 'enterprise'." },
        { status: 400 }
      );
    }
    if (!cycle || !isValidCycle(cycle)) {
      return NextResponse.json(
        { error: "Invalid cycle. Must be 'monthly' or 'yearly'." },
        { status: 400 }
      );
    }
    if (plan === "enterprise") {
      return NextResponse.json(
        { error: "Enterprise plans are sales-assisted. Please use /contact." },
        { status: 400 }
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "Invalid phone. Use a 10-digit Indian mobile number." },
        { status: 400 }
      );
    }

    const amount = getOrderAmountInPaise(plan, cycle);
    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount calculated" }, { status: 400 });
    }

    const config = getPhonePeConfig();

    // 1. Persist our order row first (so we have an internal UUID to
    //    embed in the redirect URL — survives if PhonePe truncates body)
    const merchantTransactionId = generateMerchantTransactionId();
    const order = await prisma.order.create({
      data: {
        provider: "phonepe",
        phonepeMerchantTransactionId: merchantTransactionId,
        plan,
        cycle,
        amount,
        currency: "INR",
        status: "created",
        userEmail: email || null,
        userName: name || null,
        userPhone: phone || null,
      },
    });

    // 2. Build PhonePe payload
    const appUrl = resolveAppUrl(req);
    const redirectUrl = `${appUrl}/api/phonepe/callback?orderId=${order.id}`;
    const callbackUrl = `${appUrl}/api/phonepe/webhook`;

    // PhonePe requires merchantUserId — derive a stable id from email
    // (or fall back to order id). Must be alphanumeric/_/-.
    const merchantUserId = (email || `user_${order.id.slice(0, 8)}`)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 36);

    const payload: Record<string, unknown> = {
      merchantId: config.merchantId,
      merchantTransactionId,
      merchantUserId,
      amount,
      redirectUrl,
      redirectMode: "POST",
      callbackUrl,
      paymentInstrument: { type: "PAY_PAGE" },
    };
    if (phone) {
      payload.mobileNumber = phone;
    }

    const base64Payload = encodePayload(payload);
    const xVerify = computeXVerifyForPay(
      base64Payload,
      PAY_PATH,
      config.saltKey,
      config.saltIndex
    );

    // 3. Call PhonePe /pg/v1/pay
    const phonePeRes = await fetch(`${config.baseUrl}${PAY_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-VERIFY": xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const phonePeJson: PhonePePayResponse = await phonePeRes
      .json()
      .catch(() => ({}));

    if (!phonePeRes.ok || !phonePeJson?.success) {
      const errMsg =
        phonePeJson?.message ||
        `PhonePe rejected the order (HTTP ${phonePeRes.status})`;

      await prisma.order
        .update({
          where: { id: order.id },
          data: { status: "failed", errorMsg: errMsg },
        })
        .catch(() => {});

      return NextResponse.json(
        { error: errMsg, code: phonePeJson?.code },
        { status: 502 }
      );
    }

    const checkoutUrl =
      phonePeJson?.data?.instrumentResponse?.redirectInfo?.url;
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "PhonePe response missing redirect URL" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      redirectUrl: checkoutUrl,
      orderId: order.id,
      merchantTransactionId,
      planName: PLAN_NAMES[plan],
      env: config.env,
    });
  } catch (error: unknown) {
    console.error("phonepe/create-order error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create PhonePe order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* -------------------------------------------------------------------- */
/* Types                                                                 */
/* -------------------------------------------------------------------- */

interface PhonePePayResponse {
  success?: boolean;
  code?: string;
  message?: string;
  data?: {
    merchantId?: string;
    merchantTransactionId?: string;
    instrumentResponse?: {
      type?: string;
      redirectInfo?: {
        url?: string;
        method?: string;
      };
    };
  };
}
