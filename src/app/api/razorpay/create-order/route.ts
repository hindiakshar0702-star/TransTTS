import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getRazorpayClient,
  getOrderAmountInPaise,
  isValidPlan,
  isValidCycle,
  PLAN_NAMES,
} from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * POST /api/razorpay/create-order
 *
 * Body: { plan: "starter"|"pro"|"enterprise", cycle: "monthly"|"yearly", name?, email? }
 *
 * Returns: { orderId, amount, currency, keyId, planName }
 *
 * The amount returned is in PAISE (Razorpay convention). Frontend
 * passes orderId straight into the Razorpay checkout SDK.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { plan, cycle, name, email } = body as {
      plan?: string;
      cycle?: string;
      name?: string;
      email?: string;
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

    // Enterprise should go through /contact, not self-serve checkout
    if (plan === "enterprise") {
      return NextResponse.json(
        { error: "Enterprise plans are sales-assisted. Please use /contact." },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const amount = getOrderAmountInPaise(plan, cycle);
    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount calculated" }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;

    if (!razorpay || !publicKeyId) {
      return NextResponse.json(
        {
          error:
            "Payment gateway not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID env vars.",
        },
        { status: 503 }
      );
    }

    // Razorpay receipt has 40-char limit
    const receipt = `tt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        plan,
        cycle,
        planName: PLAN_NAMES[plan],
        email: email || "",
        name: name || "",
      },
    });

    // Persist order to our DB so we can verify later & track status
    await prisma.order.create({
      data: {
        razorpayOrderId: order.id,
        plan,
        cycle,
        amount: Number(order.amount),
        currency: "INR",
        status: "created",
        userEmail: email || null,
        userName: name || null,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: publicKeyId,
      planName: PLAN_NAMES[plan],
    });
  } catch (error: unknown) {
    console.error("create-order error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
