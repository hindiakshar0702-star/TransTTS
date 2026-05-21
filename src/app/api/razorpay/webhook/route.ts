import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { computeValidUntil, isValidCycle } from "@/lib/razorpay";

export const runtime = "nodejs";
// Razorpay sends raw JSON; we MUST NOT let any framework middleware
// re-serialize the body, otherwise signature verification will fail.
export const dynamic = "force-dynamic";

/**
 * POST /api/razorpay/webhook
 *
 * Configure in Razorpay dashboard with:
 *   - URL: https://<your-domain>/api/razorpay/webhook
 *   - Secret: same value as RAZORPAY_WEBHOOK_SECRET env var
 *   - Events: order.paid, payment.captured, payment.failed,
 *             refund.created, refund.processed
 *
 * Verifies the X-Razorpay-Signature header against HMAC-SHA256 of the
 * raw body. Idempotent — re-delivering the same event leaves the DB
 * in the same state.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      // Don't 500 — return 200 so Razorpay doesn't retry forever.
      // We log so operators can spot the misconfiguration.
      console.error("Webhook received but RAZORPAY_WEBHOOK_SECRET is not set");
      return NextResponse.json({ received: false, error: "not configured" }, { status: 200 });
    }

    // Read RAW body — required for byte-exact HMAC verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    // Compute expected signature over the raw body
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(signature, "hex");
    const sigValid =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!sigValid) {
      console.warn("Webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Parse after signature has been validated
    let event: WebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    await handleEvent(event, rawBody);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("webhook error:", error);
    // Return 500 so Razorpay retries (transient DB errors etc.)
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* -------------------------------------------------------------------- */
/* Types                                                                */
/* -------------------------------------------------------------------- */

interface WebhookEvent {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    order?: { entity: RazorpayOrder };
    refund?: { entity: RazorpayRefund };
  };
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  error_description?: string;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  status: string;
}

interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

/* -------------------------------------------------------------------- */
/* Event handlers                                                       */
/* -------------------------------------------------------------------- */

async function handleEvent(event: WebhookEvent, rawBody: string) {
  switch (event.event) {
    case "order.paid":
    case "payment.captured": {
      const payment = event.payload.payment?.entity;
      if (!payment?.order_id) return;
      await markOrderPaid(payment.order_id, payment.id, rawBody);
      return;
    }

    case "payment.failed": {
      const payment = event.payload.payment?.entity;
      if (!payment?.order_id) return;
      await markOrderFailed(
        payment.order_id,
        payment.id,
        payment.error_description || "Payment failed",
        rawBody
      );
      return;
    }

    case "refund.created":
    case "refund.processed": {
      const refund = event.payload.refund?.entity;
      const payment = event.payload.payment?.entity;
      const orderId = payment?.order_id;
      if (!orderId || !refund) return;
      await markOrderRefunded(orderId, refund.id, rawBody);
      return;
    }

    default:
      // Unhandled event — store raw payload for audit on the matching order if possible
      console.log(`Unhandled Razorpay webhook event: ${event.event}`);
      return;
  }
}

async function markOrderPaid(orderId: string, paymentId: string, rawBody: string) {
  const existing = await prisma.order.findUnique({
    where: { razorpayOrderId: orderId },
  });
  if (!existing) {
    console.warn(`Webhook: order ${orderId} not found in DB`);
    return;
  }
  if (existing.status === "paid") {
    // Already processed — idempotent no-op (still update webhookEvent for audit)
    await prisma.order.update({
      where: { razorpayOrderId: orderId },
      data: { webhookEvent: rawBody },
    });
    return;
  }

  const cycle = isValidCycle(existing.cycle) ? existing.cycle : "monthly";
  const validUntil = existing.validUntil ?? computeValidUntil(cycle);

  await prisma.order.update({
    where: { razorpayOrderId: orderId },
    data: {
      status: "paid",
      razorpayPaymentId: paymentId,
      validUntil,
      webhookEvent: rawBody,
      errorMsg: null,
    },
  });
}

async function markOrderFailed(
  orderId: string,
  paymentId: string,
  errorMsg: string,
  rawBody: string
) {
  await prisma.order
    .update({
      where: { razorpayOrderId: orderId },
      data: {
        status: "failed",
        razorpayPaymentId: paymentId,
        errorMsg,
        webhookEvent: rawBody,
      },
    })
    .catch(() => {
      console.warn(`Webhook: failed to mark order ${orderId} as failed`);
    });
}

async function markOrderRefunded(orderId: string, _refundId: string, rawBody: string) {
  await prisma.order
    .update({
      where: { razorpayOrderId: orderId },
      data: {
        status: "refunded",
        webhookEvent: rawBody,
      },
    })
    .catch(() => {
      console.warn(`Webhook: failed to mark order ${orderId} as refunded`);
    });
}
