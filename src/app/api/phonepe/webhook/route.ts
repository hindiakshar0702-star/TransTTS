import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeValidUntil, isValidCycle } from "@/lib/razorpay";
import {
  getPhonePeConfig,
  verifyWebhookSignature,
  decodeResponse,
} from "@/lib/phonepe";

export const runtime = "nodejs";
// Read raw body — do not let any middleware reparse it.
export const dynamic = "force-dynamic";

/**
 * POST /api/phonepe/webhook
 *
 * Configured in PhonePe merchant dashboard or passed as `callbackUrl` in
 * the /pay payload. PhonePe S2S body shape:
 *
 *   POST /api/phonepe/webhook
 *   X-VERIFY: <sha256(base64Response + saltKey)>###<saltIndex>
 *   Content-Type: application/json
 *
 *   { "response": "<base64-encoded-json>" }
 *
 * The base64Response decodes to the same shape as the /status API response.
 * Idempotent — re-delivered events leave the DB in the same state.
 */
export async function POST(req: NextRequest) {
  try {
    const config = getPhonePeConfig();

    const rawBody = await req.text();
    const signature = req.headers.get("x-verify") || "";

    if (!signature) {
      return NextResponse.json(
        { error: "Missing X-VERIFY header" },
        { status: 400 }
      );
    }

    let envelope: { response?: string };
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const base64Response = envelope?.response;
    if (!base64Response) {
      return NextResponse.json(
        { error: "Missing 'response' field" },
        { status: 400 }
      );
    }

    // Verify signature against the base64 payload
    const sigValid = verifyWebhookSignature(
      base64Response,
      signature,
      config.saltKey,
      config.saltIndex
    );
    if (!sigValid) {
      console.warn("PhonePe webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Decode the actual payload
    let payload: PhonePeWebhookPayload;
    try {
      payload = decodeResponse<PhonePeWebhookPayload>(base64Response);
    } catch {
      return NextResponse.json(
        { error: "Could not decode response payload" },
        { status: 400 }
      );
    }

    const mtid = payload?.data?.merchantTransactionId;
    if (!mtid) {
      console.warn("PhonePe webhook missing merchantTransactionId", payload);
      // Return 200 so PhonePe doesn't retry malformed events forever
      return NextResponse.json({ received: false, reason: "no-mtid" });
    }

    const order = await prisma.order.findUnique({
      where: { phonepeMerchantTransactionId: mtid },
    });

    if (!order) {
      console.warn(`PhonePe webhook: order with MTID ${mtid} not found`);
      return NextResponse.json({ received: false, reason: "order-not-found" });
    }

    const code = payload.code;
    const state = payload.data?.state;

    /* --------------------------- Success ---------------------------- */
    if (payload.success && code === "PAYMENT_SUCCESS" && state === "COMPLETED") {
      if (order.status === "paid") {
        // Already processed — refresh audit log only
        await prisma.order.update({
          where: { id: order.id },
          data: { webhookEvent: rawBody },
        });
        return NextResponse.json({ received: true, idempotent: true });
      }

      const cycle = isValidCycle(order.cycle) ? order.cycle : "monthly";
      const validUntil = order.validUntil ?? computeValidUntil(cycle);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "paid",
          phonepeTransactionId: payload.data?.transactionId || null,
          phonepeProviderReferenceId: payload.data?.providerReferenceId || null,
          validUntil,
          webhookEvent: rawBody,
          errorMsg: null,
        },
      });

      return NextResponse.json({ received: true, status: "paid" });
    }

    /* --------------------------- Pending ---------------------------- */
    if (code === "PAYMENT_PENDING" || state === "PENDING") {
      // Keep status='created' and audit. Final state will arrive in a
      // later webhook delivery (success or failure).
      await prisma.order.update({
        where: { id: order.id },
        data: {
          webhookEvent: rawBody,
          errorMsg: payload.message || "Payment pending",
        },
      });
      return NextResponse.json({ received: true, status: "pending" });
    }

    /* --------------------------- Failure ---------------------------- */
    const errMsg = payload.message || `Payment ${state || code || "failed"}`;

    // Don't downgrade a previously-paid order to failed (defensive)
    if (order.status === "paid") {
      await prisma.order.update({
        where: { id: order.id },
        data: { webhookEvent: rawBody },
      });
      return NextResponse.json({ received: true, idempotent: true });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "failed",
        phonepeTransactionId: payload.data?.transactionId || null,
        webhookEvent: rawBody,
        errorMsg: errMsg,
      },
    });

    return NextResponse.json({ received: true, status: "failed" });
  } catch (error: unknown) {
    console.error("phonepe/webhook error:", error);
    // 5xx so PhonePe retries on transient errors (DB blip etc.)
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* -------------------------------------------------------------------- */
/* Types                                                                 */
/* -------------------------------------------------------------------- */

interface PhonePeWebhookPayload {
  success?: boolean;
  code?: string;
  message?: string;
  data?: {
    merchantId?: string;
    merchantTransactionId?: string;
    transactionId?: string;
    amount?: number;
    state?: string;
    responseCode?: string;
    providerReferenceId?: string;
    paymentInstrument?: Record<string, unknown>;
  };
}
