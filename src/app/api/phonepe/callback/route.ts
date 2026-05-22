import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeValidUntil, isValidCycle } from "@/lib/razorpay";
import { getPhonePeConfig, computeXVerifyForStatus } from "@/lib/phonepe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/phonepe/callback
 *
 * Browser redirect target after PhonePe checkout. Receives the user
 * back from PhonePe (POST when redirectMode='POST', GET if 'REDIRECT')
 * with the merchantTransactionId. We do NOT trust the redirect payload
 * alone — we always call PhonePe's /status API server-to-server to
 * confirm the actual payment state, then update the Order and 302
 * redirect the user to /upgrade/success.
 *
 * Both verbs are handled by the same logic.
 */

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");

  // Build absolute redirect URL using the same resolution as create-order
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;

  // No orderId in query — graceful fallback to the upgrade page
  if (!orderId) {
    return NextResponse.redirect(`${appUrl}/upgrade/success`, { status: 303 });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.provider !== "phonepe" || !order.phonepeMerchantTransactionId) {
      return NextResponse.redirect(
        `${appUrl}/upgrade/success?orderId=${encodeURIComponent(orderId)}`,
        { status: 303 }
      );
    }

    // Idempotent — already verified earlier by webhook or a previous callback
    if (order.status === "paid") {
      return NextResponse.redirect(
        `${appUrl}/upgrade/success?orderId=${encodeURIComponent(order.id)}&provider=phonepe`,
        { status: 303 }
      );
    }

    // Server-to-server status check
    const config = getPhonePeConfig();
    const statusPath = `/pg/v1/status/${config.merchantId}/${order.phonepeMerchantTransactionId}`;
    const xVerify = computeXVerifyForStatus(statusPath, config.saltKey, config.saltIndex);

    const statusRes = await fetch(`${config.baseUrl}${statusPath}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-VERIFY": xVerify,
        "X-MERCHANT-ID": config.merchantId,
      },
      // PhonePe sandbox occasionally takes 4-5s to settle
      cache: "no-store",
    });

    const statusJson: PhonePeStatusResponse = await statusRes.json().catch(() => ({}));
    const code = statusJson?.code;
    const state = statusJson?.data?.state;

    // PAYMENT_SUCCESS / state COMPLETED → mark paid
    if (statusJson?.success && code === "PAYMENT_SUCCESS" && state === "COMPLETED") {
      const cycle = isValidCycle(order.cycle) ? order.cycle : "monthly";
      const validUntil = order.validUntil ?? computeValidUntil(cycle);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "paid",
          phonepeTransactionId: statusJson.data?.transactionId || null,
          phonepeProviderReferenceId: statusJson.data?.providerReferenceId || null,
          validUntil,
          errorMsg: null,
        },
      });

      return NextResponse.redirect(
        `${appUrl}/upgrade/success?orderId=${encodeURIComponent(order.id)}&provider=phonepe`,
        { status: 303 }
      );
    }

    // PENDING — webhook will eventually mark it paid; show pending UI on success page
    if (code === "PAYMENT_PENDING" || state === "PENDING") {
      await prisma.order.update({
        where: { id: order.id },
        data: { errorMsg: "Payment pending — awaiting bank confirmation" },
      });
      return NextResponse.redirect(
        `${appUrl}/upgrade/success?orderId=${encodeURIComponent(order.id)}&provider=phonepe&pending=1`,
        { status: 303 }
      );
    }

    // Anything else → mark failed
    const errMsg = statusJson?.message || `Payment ${state || code || "failed"}`;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "failed",
        errorMsg: errMsg,
      },
    });

    return NextResponse.redirect(
      `${appUrl}/upgrade/success?orderId=${encodeURIComponent(order.id)}&provider=phonepe&failed=1`,
      { status: 303 }
    );
  } catch (error: unknown) {
    console.error("phonepe/callback error:", error);
    // Always redirect to success page so user isn't stranded; the page's
    // pending/error UI will surface the issue.
    return NextResponse.redirect(
      `${appUrl}/upgrade/success?orderId=${encodeURIComponent(orderId)}&provider=phonepe&pending=1`,
      { status: 303 }
    );
  }
}

/* -------------------------------------------------------------------- */
/* Types                                                                 */
/* -------------------------------------------------------------------- */

interface PhonePeStatusResponse {
  success?: boolean;
  code?: string;
  message?: string;
  data?: {
    merchantId?: string;
    merchantTransactionId?: string;
    transactionId?: string;
    amount?: number;
    state?: string; // "COMPLETED" | "FAILED" | "PENDING"
    responseCode?: string;
    providerReferenceId?: string;
    paymentInstrument?: Record<string, unknown>;
  };
}
