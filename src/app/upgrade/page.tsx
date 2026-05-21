"use client";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useToast } from "@/components/Toast";

type PlanId = "starter" | "pro" | "enterprise";
type Cycle = "monthly" | "yearly";

const PLANS: Record<PlanId, {
  name: string;
  monthly: number;
  yearly: number;
  desc: string;
  features: string[];
  emoji: string;
}> = {
  starter: {
    name: "Starter",
    monthly: 299,
    yearly: 2499,
    emoji: "🌱",
    desc: "For students & solo creators",
    features: [
      "5 hours transcription / month",
      "100,000 chars translation",
      "100,000 chars TTS",
      "1 Voice Clone",
      "60 min noise removal",
      "100 MB file size limit",
      "HD audio quality",
      "All export formats + PDF",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    monthly: 999,
    yearly: 8499,
    emoji: "⚡",
    desc: "For content creators & podcasters",
    features: [
      "25 hours transcription / month",
      "500,000 chars translation",
      "500,000 chars TTS",
      "5 Voice Clones",
      "5 hours noise removal",
      "200 MB file size limit",
      "Advanced TTS (emotions, multi-speaker)",
      "Priority processing (2x faster)",
      "API access (limited)",
      "Priority email + chat support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    monthly: 2999,
    yearly: 25999,
    emoji: "🏢",
    desc: "For teams & businesses at scale",
    features: [
      "Unlimited transcription, translation & TTS",
      "Unlimited Voice Clones",
      "Unlimited noise removal",
      "Custom voice training",
      "500 MB file size limit",
      "Full REST API access + webhooks",
      "Team accounts (10 seats)",
      "Dedicated account manager",
      "99.9% SLA uptime",
      "On-premise option available",
    ],
  },
};

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/* ------------------------------------------------------------------ */
/* Razorpay typings                                                    */
/* ------------------------------------------------------------------ */

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: { error: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function UpgradePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <UpgradeContent />
    </Suspense>
  );
}

function UpgradeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const initialPlan = (searchParams.get("plan") as PlanId) || "pro";
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [selected, setSelected] = useState<PlanId>(
    PLANS[initialPlan] ? initialPlan : "pro"
  );

  // Customer details for Razorpay prefill
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = searchParams.get("plan") as PlanId;
    if (p && PLANS[p]) setSelected(p);
  }, [searchParams]);

  // Pre-load Razorpay script in background so checkout opens instantly
  useEffect(() => {
    loadRazorpayScript().catch(() => {});
  }, []);

  const plan = PLANS[selected];
  const price = cycle === "monthly" ? plan.monthly : plan.yearly;
  const monthlyEquivalent =
    cycle === "monthly" ? plan.monthly : Math.round(plan.yearly / 12);
  const savedPercent =
    cycle === "yearly"
      ? Math.round((1 - plan.yearly / (plan.monthly * 12)) * 100)
      : 0;
  const gst = Math.round(price * 0.18);
  const total = price + gst;

  /* -------------------------------------------------------------- */
  /* Pay handler                                                     */
  /* -------------------------------------------------------------- */

  const handlePay = useCallback(async () => {
    if (loading) return;

    if (!name.trim()) {
      showToast("Please enter your full name", "error");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    setLoading(true);
    try {
      // 1. Ensure Razorpay SDK is available
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error("Could not load Razorpay. Check your internet connection.");
      }

      // 2. Create order on the server
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, cycle, name, email }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create order (${orderRes.status})`);
      }

      const { orderId, amount, currency, keyId, planName } = await orderRes.json();
      if (!orderId || !keyId) {
        throw new Error("Invalid response from payment server");
      }

      // 3. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "TransTTS AI",
        description: `${planName} Plan — ${cycle === "yearly" ? "Yearly" : "Monthly"}`,
        order_id: orderId,
        prefill: { name, email },
        notes: { plan: selected, cycle },
        theme: { color: "#6366f1" },
        modal: {
          ondismiss: () => {
            setLoading(false);
            showToast("Payment cancelled", "info");
          },
        },
        handler: async (response) => {
          // 4. Verify on server
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.verified) {
              showToast(
                verifyData.error || "Payment verification failed. Contact support.",
                "error"
              );
              setLoading(false);
              return;
            }

            // 5. Redirect to success page
            const params = new URLSearchParams({
              orderId: verifyData.orderId,
              plan: verifyData.plan,
              cycle: verifyData.cycle,
              paymentId: response.razorpay_payment_id,
            });
            router.push(`/upgrade/success?${params.toString()}`);
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "Verification request failed",
              "error"
            );
            setLoading(false);
          }
        },
      });

      rzp.on("payment.failed", (resp) => {
        showToast(
          resp.error?.description || "Payment failed. Please try again.",
          "error"
        );
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Something went wrong",
        "error"
      );
      setLoading(false);
    }
  }, [loading, name, email, selected, cycle, router, showToast]);

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container" style={{ maxWidth: 800 }}>
          <div className="app-header fade-in">
            <h1>🚀 <span className="gradient-text">Upgrade Your Plan</span></h1>
            <p>Unlock unlimited AI-powered transcription, translation, voice cloning &amp; more</p>
          </div>

          {/* Plan tabs */}
          <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
              {(Object.keys(PLANS) as PlanId[]).map((id) => (
                <button
                  key={id}
                  className={`tab ${selected === id ? "active" : ""}`}
                  onClick={() => setSelected(id)}
                  disabled={loading}
                >
                  {PLANS[id].emoji} {PLANS[id].name}
                </button>
              ))}
            </div>

            {/* Billing cycle toggle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div className="billing-toggle">
                <button
                  className={`billing-option ${cycle === "monthly" ? "active" : ""}`}
                  onClick={() => setCycle("monthly")}
                  disabled={loading}
                >
                  Monthly
                </button>
                <button
                  className={`billing-option ${cycle === "yearly" ? "active" : ""}`}
                  onClick={() => setCycle("yearly")}
                  disabled={loading}
                >
                  Yearly
                  {savedPercent > 0 && <span className="save-badge">Save {savedPercent}%</span>}
                </button>
              </div>
            </div>

            {/* Price display */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div className="pricing-amount" style={{ fontSize: "3.5rem" }}>
                ₹{monthlyEquivalent.toLocaleString()}
              </div>
              <div className="pricing-period">
                / month {cycle === "yearly" && <span style={{ color: "var(--text-muted)" }}>(billed yearly)</span>}
              </div>
              <p className="pricing-desc" style={{ marginTop: 8 }}>{plan.desc}</p>
            </div>

            {/* Features */}
            <div className="upgrade-features">
              {plan.features.map((f, i) => (
                <div key={i} className="upgrade-feature-item">
                  <span>✅</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Customer details (for non-enterprise) */}
          {selected !== "enterprise" && (
            <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 20 }}>👤 Your Details</h3>
              <div className="form-grid">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="select-input"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="select-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>
              <p className="form-hint" style={{ marginTop: 8 }}>
                Receipt &amp; account access will be sent to this email
              </p>
            </div>
          )}

          {/* Order Summary + Razorpay CTA */}
          <div className="glass-card fade-in">
            <h3 style={{ marginBottom: 20 }}>📋 Order Summary</h3>

            <div style={{
              padding: "16px 20px", background: "var(--glass)",
              borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-dim)" }}>
                  {plan.emoji} {plan.name} Plan ({cycle === "monthly" ? "Monthly" : "Yearly"})
                </span>
                <span>₹{price.toLocaleString()}</span>
              </div>
              {cycle === "yearly" && savedPercent > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#10b981" }}>
                  <span>Yearly discount ({savedPercent}%)</span>
                  <span>Saved ₹{(plan.monthly * 12 - plan.yearly).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-dim)" }}>GST (18%)</span>
                <span>₹{gst.toLocaleString()}</span>
              </div>
              <div style={{
                borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4,
                display: "flex", justifyContent: "space-between", fontWeight: 700,
                fontSize: "1.05rem",
              }}>
                <span>Total payable</span>
                <span className="gradient-text">₹{total.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment methods preview */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: 8 }}>
                Pay via:
              </div>
              <div className="payment-methods" style={{ justifyContent: "flex-start", marginTop: 0 }}>
                <span className="payment-method">📱 UPI</span>
                <span className="payment-method">💳 Cards</span>
                <span className="payment-method">🏦 Net Banking</span>
                <span className="payment-method">📲 Wallets</span>
              </div>
            </div>

            {selected === "enterprise" ? (
              <Link
                href="/contact"
                className="btn btn-primary btn-large"
                style={{ width: "100%", textAlign: "center" }}
              >
                💬 Contact Sales for Custom Pricing
              </Link>
            ) : (
              <button
                className="btn btn-primary btn-large"
                style={{ width: "100%" }}
                onClick={handlePay}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner"></span> Processing...</>
                ) : (
                  <>🔒 Pay ₹{total.toLocaleString()} with Razorpay</>
                )}
              </button>
            )}

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 12 }}>
              🛡️ 7-day money-back guarantee • 🔒 Secured by Razorpay • Cancel anytime
            </p>
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/pricing" className="btn btn-ghost">← Back to Pricing</Link>
          </div>
        </div>
      </main>
    </>
  );
}
