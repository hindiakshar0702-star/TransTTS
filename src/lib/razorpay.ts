import Razorpay from "razorpay";

/**
 * Single source of truth for plan pricing across server + client.
 * Amounts are in INR rupees (NOT paise). GST is added at checkout time.
 */
export const PLAN_PRICES = {
  starter: { monthly: 299, yearly: 2499 },
  pro: { monthly: 999, yearly: 8499 },
  enterprise: { monthly: 2999, yearly: 25999 },
} as const;

export const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export type PlanId = keyof typeof PLAN_PRICES;
export type Cycle = "monthly" | "yearly";

export const GST_RATE = 0.18;

/**
 * Returns total amount payable in PAISE (Razorpay always uses paise).
 * Includes 18% GST on top of base price.
 */
export function getOrderAmountInPaise(plan: PlanId, cycle: Cycle): number {
  const prices = PLAN_PRICES[plan];
  if (!prices) return 0;
  const base = cycle === "yearly" ? prices.yearly : prices.monthly;
  const withGst = base * (1 + GST_RATE);
  return Math.round(withGst * 100); // rupees -> paise
}

/**
 * Compute the validity end-date for a successful payment.
 * monthly: +30 days, yearly: +365 days.
 */
export function computeValidUntil(cycle: Cycle, from: Date = new Date()): Date {
  const end = new Date(from);
  if (cycle === "yearly") {
    end.setDate(end.getDate() + 365);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return end;
}

/**
 * Lazy-initialised Razorpay server SDK client.
 * Returns null when keys are missing (so dev environments without keys
 * can still build / render pages without crashing).
 */
let _client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  if (!_client) {
    _client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _client;
}

/**
 * Validates that the given (plan, cycle) combination is real.
 */
export function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_PRICES;
}
export function isValidCycle(cycle: string): cycle is Cycle {
  return cycle === "monthly" || cycle === "yearly";
}
