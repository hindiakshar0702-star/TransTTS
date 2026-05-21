"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

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

export default function UpgradePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <UpgradeContent />
    </Suspense>
  );
}

function UpgradeContent() {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") as PlanId) || "pro";
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [selected, setSelected] = useState<PlanId>(
    PLANS[initialPlan] ? initialPlan : "pro"
  );

  useEffect(() => {
    const p = searchParams.get("plan") as PlanId;
    if (p && PLANS[p]) setSelected(p);
  }, [searchParams]);

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
                >
                  Monthly
                </button>
                <button
                  className={`billing-option ${cycle === "yearly" ? "active" : ""}`}
                  onClick={() => setCycle("yearly")}
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
              <button className="btn btn-primary btn-large" style={{ width: "100%" }}>
                🔒 Pay ₹{total.toLocaleString()} with Razorpay
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
