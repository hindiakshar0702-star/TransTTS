import Razorpay from "razorpay";

/**
 * Razorpay-server-only utilities (Razorpay SDK is Node-only and must
 * never be imported into a "use client" component).
 *
 * Pricing data lives in @/lib/pricing — both client and server should
 * import shared types/functions from there, while this file owns the
 * authenticated SDK client.
 */

export {
  PLAN_PRICES,
  PLAN_NAMES,
  GST_RATE,
  normalizeCycle,
  cycleMonths,
  formatCycle,
  getBasePrice,
  getOrderAmountInPaise,
  getPriceBreakdown,
  formatInrFromPaise,
  computeValidUntil,
  cycleSavingsPercent,
  monthlyEquivalent,
  isValidPlan,
  isValidCycle,
} from "./pricing";
export type { PlanId, Cycle, CycleKey, PriceBreakdown } from "./pricing";

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
