import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PLAN_NAMES } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * GET /api/razorpay/order/[id]
 *
 * `id` accepts EITHER our internal Order.id (UUID)
 * OR the razorpay order id (`order_xxx`).
 *
 * Returns a sanitised view of the order — does NOT include the
 * razorpaySignature or webhookEvent fields, so it's safe to expose
 * to the success page in the browser.
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

    const order = id.startsWith("order_")
      ? await prisma.order.findUnique({ where: { razorpayOrderId: id } })
      : await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: order.id,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      plan: order.plan,
      planName: PLAN_NAMES[order.plan] || order.plan,
      cycle: order.cycle,
      amount: order.amount, // in paise
      currency: order.currency,
      status: order.status,
      userEmail: order.userEmail,
      userName: order.userName,
      validUntil: order.validUntil,
      createdAt: order.createdAt,
    });
  } catch (error: unknown) {
    console.error("get-order error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
