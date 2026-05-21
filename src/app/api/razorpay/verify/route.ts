import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import {
  computeValidUntil,
  isValidCycle,
  PLAN_NAMES,
} from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * POST /api/razorpay/verify
 *
 * Body: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string
 * }
 *
 * Verifies the Razorpay HMAC-SHA256 signature using RAZORPAY_KEY_SECRET
 * over `${order_id}|${payment_id}`. On success, marks the Order as 'paid'
 * and computes a validUntil window for the subscription.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature" },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Payment verification not configured (missing RAZORPAY_KEY_SECRET)" },
        { status: 503 }
      );
    }

    // 1. Look up order in our DB first — prevents replay against orders we never created
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!order) {
      return NextResponse.json(
        { verified: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.status === "paid") {
      // Idempotent — already verified earlier (e.g. by webhook)
      return NextResponse.json({
        verified: true,
        orderId: order.id,
        plan: order.plan,
        cycle: order.cycle,
        planName: PLAN_NAMES[order.plan] || order.plan,
        validUntil: order.validUntil,
        alreadyPaid: true,
      });
    }

    // 2. Compute expected signature
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // 3. Timing-safe compare to avoid timing attacks
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(razorpay_signature, "hex");
    const sigValid =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!sigValid) {
      // Mark as failed and audit-log
      await prisma.order
        .update({
          where: { razorpayOrderId: razorpay_order_id },
          data: {
            status: "failed",
            errorMsg: "Signature verification failed",
            razorpayPaymentId: razorpay_payment_id,
          },
        })
        .catch(() => {});

      return NextResponse.json(
        { verified: false, error: "Invalid signature — payment verification failed" },
        { status: 400 }
      );
    }

    // 4. Compute subscription validity window
    const cycle = isValidCycle(order.cycle) ? order.cycle : "monthly";
    const validUntil = computeValidUntil(cycle);

    // 5. Mark as paid
    const updated = await prisma.order.update({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "paid",
        validUntil,
        errorMsg: null,
      },
    });

    return NextResponse.json({
      verified: true,
      orderId: updated.id,
      plan: updated.plan,
      cycle: updated.cycle,
      planName: PLAN_NAMES[updated.plan] || updated.plan,
      validUntil: updated.validUntil,
    });
  } catch (error: unknown) {
    console.error("verify error:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
