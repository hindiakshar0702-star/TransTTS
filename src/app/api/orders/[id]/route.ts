import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PLAN_NAMES } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * GET /api/orders/[id]
 *
 * Unified order lookup that works across all payment providers.
 * `id` accepts any of:
 *   - Internal Order.id (UUID)            — primary
 *   - Razorpay order id (`order_xxx`)     — legacy convenience
 *   - PhonePe merchantTransactionId (`MT_…`)
 *
 * Returns a sanitised view — never includes razorpaySignature or the
 * raw webhook payload, so it's safe to expose to the browser.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    let order = null;

    if (id.startsWith("order_")) {
      // Razorpay order id
      order = await prisma.order.findUnique({
        where: { razorpayOrderId: id },
      });
    } else if (id.startsWith("MT_")) {
      // PhonePe merchantTransactionId
      order = await prisma.order.findUnique({
        where: { phonepeMerchantTransactionId: id },
      });
    } else {
      // Internal UUID (default)
      order = await prisma.order.findUnique({ where: { id } });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Pick the right gateway-side payment id for display
    const paymentId =
      order.provider === "phonepe"
        ? order.phonepeTransactionId
        : order.razorpayPaymentId;
    const externalOrderId =
      order.provider === "phonepe"
        ? order.phonepeMerchantTransactionId
        : order.razorpayOrderId;

    return NextResponse.json({
      id: order.id,
      provider: order.provider,
      // Generic display fields
      externalOrderId,
      paymentId,
      // Provider-specific (kept for callers that need them)
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      phonepeMerchantTransactionId: order.phonepeMerchantTransactionId,
      phonepeTransactionId: order.phonepeTransactionId,
      phonepeProviderReferenceId: order.phonepeProviderReferenceId,
      // Plan/billing
      plan: order.plan,
      planName: PLAN_NAMES[order.plan] || order.plan,
      cycle: order.cycle,
      amount: order.amount, // in paise
      currency: order.currency,
      status: order.status,
      // Customer
      userEmail: order.userEmail,
      userName: order.userName,
      userPhone: order.userPhone,
      // Validity
      validUntil: order.validUntil,
      createdAt: order.createdAt,
      // Surface failure reason but never the full webhook payload
      errorMsg: order.errorMsg,
    });
  } catch (error: unknown) {
    console.error("orders/[id] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
