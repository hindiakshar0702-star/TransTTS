"use client";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useToast } from "@/components/Toast";

type PlanId = "starter" | "pro" | "enterprise";
type Cycle = "monthly" | "yearly";
type Provider = "razorpay" | "phonepe";

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

const PROVIDER_LABEL: Record<Provider, { name: string; emoji: string; tagline: string }> = {
  razorpay: {
    name: "Razorpay",
    emoji: "💳",
    tagline: "UPI, Cards, Net Banking, Wallets",
  },
  phonepe: {
    name: "PhonePe",
    emoji: "📱",
    tagline: "PhonePe app, UPI, Cards & more",
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

interface ProviderInfo {
  available: Provider[];
  default: Provider | null;
}

async function fetchAvailableProviders(): Promise<ProviderInfo> {
  try {
    const res = await fetch("/api/payment-providers", { cache: "no-store" });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return {
      available: (data.available || []) as Provider[],
      default: (data.default || null) as Provider | null,
    };
  } catch {
    // Fail open — assume Razorpay only so the page still renders
    return { available: ["razorpay"], default: "razorpay" };
  }
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

  // Provider state
  const [provider, setProvider] = useState<Provider>("razorpay");
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([
    "razorpay",
  ]);

  // Customer details (shared between providers)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync plan from query param
  useEffect(() => {
    const p = searchParams.get("plan") as PlanId;
    if (p && PLANS[p]) setSelected(p);
  }, [searchParams]);

  // Discover which providers are configured server-side
  useEffect(() => {
    fetchAvailableProviders().then((info) => {
      const list = info.available.length > 0 ? info.available : (["razorpay"] as Provider[]);
      setAvailableProviders(list);
      // honour ?provider= query if it's available
      const queryProvider = searchParams.get("provider") as Provider | null;
      if (queryProvider && list.includes(queryProvider)) {
        setProvider(queryProvider);
      } else if (info.default && list.includes(info.default)) {
        setProvider(info.default);
      } else {
        setProvider(list[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-load Razorpay script in background so checkout opens instantly
  useEffect(() => {
    if (provider === "razorpay") {
      loadRazorpayScript().catch(() => {});
    }
  }, [provider]);

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
  /* Validation                                                      */
  /* -------------------------------------------------------------- */

  const validateInputs = useCallback((): boolean => {
    if (!name.trim()) {
      showToast("Please enter your full name", "error");
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address", "error");
      return false;
    }
    // Phone is optional for Razorpay, also optional but recommended for PhonePe
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      showToast(
        "Phone must be a 10-digit Indian mobile number (starts with 6-9)",
        "error"
      );
      return false;
    }
    return true;
  }, [name, email, phone, showToast]);

  /* -------------------------------------------------------------- */
  /* Razorpay flow                                                   */
  /* -------------------------------------------------------------- */

  const payWithRazorpay = useCallback(async () => {
    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      throw new Error("Could not load Razorpay. Check your internet connection.");
    }

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

    const rzp = new window.Razorpay({
      key: keyId,
      amount,
      currency,
      name: "TransTTS AI",
      description: `${planName} Plan — ${cycle === "yearly" ? "Yearly" : "Monthly"}`,
      order_id: orderId,
      prefill: { name, email, contact: phone || undefined },
      notes: { plan: selected, cycle },
      theme: { color: "#6366f1" },
      modal: {
        ondismiss: () => {
          setLoading(false);
          showToast("Payment cancelled", "info");
        },
      },
      handler: async (response) => {
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

          const params = new URLSearchParams({
            orderId: verifyData.orderId,
            plan: verifyData.plan,
            cycle: verifyData.cycle,
            paymentId: response.razorpay_payment_id,
            provider: "razorpay",
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
  }, [selected, cycle, name, email, phone, router, showToast]);

  /* -------------------------------------------------------------- */
  /* PhonePe flow                                                    */
  /* -------------------------------------------------------------- */

  const payWithPhonePe = useCallback(async () => {
    const orderRes = await fetch("/api/phonepe/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: selected,
        cycle,
        name,
        email,
        phone: phone || undefined,
      }),
    });

    if (!orderRes.ok) {
      const data = await orderRes.json().catch(() => ({}));
      throw new Error(data.error || `Failed to create PhonePe order (${orderRes.status})`);
    }

    const { redirectUrl } = await orderRes.json();
    if (!redirectUrl) {
      throw new Error("PhonePe response missing redirect URL");
    }

    // Full-page redirect — user goes to PhonePe checkout, comes back via /api/phonepe/callback
    window.location.href = redirectUrl;
  }, [selected, cycle, name, email, phone]);

  /* -------------------------------------------------------------- */
  /* Pay handler (dispatches to selected provider)                   */
  /* -------------------------------------------------------------- */

  const handlePay = useCallback(async () => {
    if (loading) return;
    if (!validateInputs()) return;

    setLoading(true);
    try {
      if (provider === "phonepe") {
        await payWithPhonePe();
        // user is being redirected — keep loading=true until navigation
      } else {
        await payWithRazorpay();
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Something went wrong",
        "error"
      );
      setLoading(false);
    }
  }, [loading, provider, validateInputs, payWithPhonePe, payWithRazorpay, showToast]);

  const showProviderToggle = availableProviders.length > 1;
  const providerLabel = PROVIDER_LABEL[provider];
  const buttonLabel =
    provider === "phonepe"
      ? `📱 Pay ₹${total.toLocaleString()} with PhonePe`
      : `🔒 Pay ₹${total.toLocaleString()} with Razorpay`;

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
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">
                    Mobile (10 digits)
                    {provider === "phonepe" && (
                      <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
                        {" "}— recommended for PhonePe app
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    className="select-input"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    disabled={loading}
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>
              </div>
              <p className="form-hint" style={{ marginTop: 8 }}>
                Receipt &amp; account access will be sent to this email
              </p>
            </div>
          )}

          {/* Provider toggle (only when 2+ providers configured) */}
          {selected !== "enterprise" && showProviderToggle && (
            <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ marginBottom: 12 }}>
                💼 Choose Payment Provider
              </label>
              <div className="billing-toggle full-width">
                {(["razorpay", "phonepe"] as Provider[]).map((p) => {
                  const meta = PROVIDER_LABEL[p];
                  const isAvailable = availableProviders.includes(p);
                  return (
                    <button
                      key={p}
                      className={`billing-option ${provider === p ? "active" : ""}`}
                      onClick={() => setProvider(p)}
                      disabled={loading || !isAvailable}
                      type="button"
                    >
                      <span style={{ fontSize: "1.1rem" }}>{meta.emoji}</span>
                      <span>{meta.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="provider-tagline">{providerLabel.tagline}</div>
            </div>
          )}

          {/* Order Summary + Pay CTA */}
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
                Pay via {providerLabel.name}:
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
                  buttonLabel
                )}
              </button>
            )}

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 12 }}>
              🛡️ 7-day money-back guarantee • 🔒 Secured by {providerLabel.name} • Cancel anytime
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
