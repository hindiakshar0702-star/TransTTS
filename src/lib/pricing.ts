/**
 * Single source of truth for pricing — usable on both client and server.
 *
 * Cycle keys:
 *   monthly  → 30 days
 *   y1       → 1 year   (~29-30% off vs monthly×12)
 *   y2       → 2 years  (~37% off  vs monthly×24)
 *   y3       → 3 years  (~42% off  vs monthly×36)
 *
 * "yearly" is preserved as a legacy alias for "y1" so existing API consumers
 * and DB rows continue working unchanged.
 */

export const PLAN_PRICES = {
  starter: {
    monthly: 299,
    y1: 2499,
    y2: 4499,
    y3: 6299,
  },
  pro: {
    monthly: 999,
    y1: 8499,
    y2: 14999,
    y3: 20999,
  },
  enterprise: {
    monthly: 2999,
    y1: 25999,
    y2: 47999,
    y3: 64999,
  },
} as const;

export const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export type PlanId = keyof typeof PLAN_PRICES;

/**
 * Canonical billing cycle. "yearly" is a legacy alias for "y1".
 */
export type Cycle = "monthly" | "y1" | "y2" | "y3" | "yearly";

/** Strict (non-legacy) cycle keys actually used in the price table. */
export type CycleKey = "monthly" | "y1" | "y2" | "y3";

export const GST_RATE = 0.18;

/**
 * Map any cycle string (including legacy "yearly") to the canonical
 * pricing key. Unknown values default to "monthly".
 */
export function normalizeCycle(cycle: string): CycleKey {
  if (cycle === "monthly" || cycle === "y1" || cycle === "y2" || cycle === "y3") {
    return cycle;
  }
  if (cycle === "yearly") return "y1";
  return "monthly";
}

/** Number of months covered by a billing cycle. */
export function cycleMonths(cycle: string): number {
  switch (normalizeCycle(cycle)) {
    case "monthly":
      return 1;
    case "y1":
      return 12;
    case "y2":
      return 24;
    case "y3":
      return 36;
  }
}

/** Human-readable cycle label for receipts and UI. */
export function formatCycle(cycle: string): string {
  switch (normalizeCycle(cycle)) {
    case "monthly":
      return "Monthly";
    case "y1":
      return "1 Year";
    case "y2":
      return "2 Years";
    case "y3":
      return "3 Years";
  }
}

/**
 * Base price in INR rupees for a (plan, cycle) combo. Excludes GST.
 * Returns 0 if either plan or cycle is unrecognised.
 */
export function getBasePrice(plan: PlanId, cycle: string): number {
  const prices = PLAN_PRICES[plan];
  if (!prices) return 0;
  return prices[normalizeCycle(cycle)] ?? 0;
}

/**
 * Total amount payable in PAISE (Razorpay/PhonePe always use paise).
 * Includes 18% GST on top of the base price.
 */
export function getOrderAmountInPaise(plan: PlanId, cycle: string): number {
  const base = getBasePrice(plan, cycle);
  if (base <= 0) return 0;
  const withGst = base * (1 + GST_RATE);
  return Math.round(withGst * 100);
}

/**
 * Validity end-date for a successful payment, given the cycle.
 */
export function computeValidUntil(cycle: string, from: Date = new Date()): Date {
  const end = new Date(from);
  switch (normalizeCycle(cycle)) {
    case "monthly":
      end.setDate(end.getDate() + 30);
      break;
    case "y1":
      end.setFullYear(end.getFullYear() + 1);
      break;
    case "y2":
      end.setFullYear(end.getFullYear() + 2);
      break;
    case "y3":
      end.setFullYear(end.getFullYear() + 3);
      break;
  }
  return end;
}

/**
 * Discount percentage saved by choosing a multi-month cycle vs paying
 * the same number of months at the monthly rate. 0 for monthly itself
 * or when prices are missing.
 */
export function cycleSavingsPercent(plan: PlanId, cycle: string): number {
  const months = cycleMonths(cycle);
  if (months <= 1) return 0;
  const monthly = getBasePrice(plan, "monthly");
  const cycleTotal = getBasePrice(plan, cycle);
  if (monthly <= 0 || cycleTotal <= 0) return 0;
  const fullCost = monthly * months;
  return Math.round((1 - cycleTotal / fullCost) * 100);
}

/**
 * Monthly-equivalent price for display ("₹708/month, billed yearly").
 */
export function monthlyEquivalent(plan: PlanId, cycle: string): number {
  const total = getBasePrice(plan, cycle);
  const months = cycleMonths(cycle);
  if (months <= 0) return total;
  return Math.round(total / months);
}

/* -------------------------------------------------------------------- */
/* Validators                                                            */
/* -------------------------------------------------------------------- */

export function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_PRICES;
}

export function isValidCycle(cycle: string): cycle is Cycle {
  return (
    cycle === "monthly" ||
    cycle === "yearly" ||
    cycle === "y1" ||
    cycle === "y2" ||
    cycle === "y3"
  );
}
