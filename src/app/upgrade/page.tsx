"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function UpgradePage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState("pro");

  const plans = {
    pro: {
      name: "Pro",
      monthly: 499,
      yearly: 4799,
      desc: "For content creators & professionals",
      features: [
        "Unlimited transcriptions",
        "Unlimited translations",
        "18+ Neural TTS voices",
        "All export formats + PDF",
        "OpenAI Whisper + Groq",
        "Premium HD voices",
        "100 MB file size limit",
        "Priority processing",
      ],
    },
    enterprise: {
      name: "Enterprise",
      monthly: 2999,
      yearly: 28999,
      desc: "For teams & businesses at scale",
      features: [
        "Everything in Pro",
        "Custom neural voices",
        "Multi-engine AI pipeline",
        "Ultra HD voice quality",
        "500 MB file size limit",
        "Team dashboard & analytics",
        "Dedicated support",
        "Full REST API access",
      ],
    },
  };

  const plan = plans[selectedPlan as keyof typeof plans];
  const price = billingCycle === "monthly" ? plan.monthly : plan.yearly;
  const savedPercent = billingCycle === "yearly" ? Math.round((1 - plan.yearly / (plan.monthly * 12)) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container" style={{ maxWidth: 800 }}>
          <div className="app-header fade-in">
            <h1>🚀 <span className="gradient-text">Upgrade Your Plan</span></h1>
            <p>Unlock unlimited AI-powered transcription, translation & voice generation</p>
          </div>

          {/* Plan Toggle */}
          <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
              <button
                className={`tab ${selectedPlan === "pro" ? "active" : ""}`}
                onClick={() => setSelectedPlan("pro")}
              >
                ⚡ Pro
              </button>
              <button
                className={`tab ${selectedPlan === "enterprise" ? "active" : ""}`}
                onClick={() => setSelectedPlan("enterprise")}
              >
                🏢 Enterprise
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div className="billing-toggle">
                <button
                  className={`billing-option ${billingCycle === "monthly" ? "active" : ""}`}
                  onClick={() => setBillingCycle("monthly")}
                >
                  Monthly
                </button>
                <button
                  className={`billing-option ${billingCycle === "yearly" ? "active" : ""}`}
                  onClick={() => setBillingCycle("yearly")}
                >
                  Yearly {savedPercent > 0 && <span className="save-badge">Save {savedPercent}%</span>}
                </button>
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div className="pricing-amount" style={{ fontSize: "3.5rem" }}>₹{price.toLocaleString()}</div>
              <div className="pricing-period">/ {billingCycle === "monthly" ? "month" : "year"}</div>
              <p className="pricing-desc" style={{ marginTop: 8 }}>{plan.desc}</p>
            </div>

            <div className="upgrade-features">
              {plan.features.map((f, i) => (
                <div key={i} className="upgrade-feature-item">
                  <span>✅</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Payment Form */}
          <div className="glass-card fade-in">
            <h3 style={{ marginBottom: 20 }}>💳 Payment Details</h3>

            <div className="form-grid">
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" className="select-input" placeholder="John Doe" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="select-input" placeholder="john@example.com" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Card Number</label>
                <input type="text" className="select-input" placeholder="4242 4242 4242 4242" maxLength={19} />
              </div>
              <div>
                <label className="form-label">Expiry</label>
                <input type="text" className="select-input" placeholder="MM/YY" maxLength={5} />
              </div>
              <div>
                <label className="form-label">CVV</label>
                <input type="text" className="select-input" placeholder="123" maxLength={4} />
              </div>
            </div>

            <div style={{ marginTop: 24, padding: "16px 20px", background: "var(--glass)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-dim)" }}>{plan.name} Plan ({billingCycle})</span>
                <span>₹{price.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-dim)" }}>Tax (GST 18%)</span>
                <span>₹{Math.round(price * 0.18).toLocaleString()}</span>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Total</span>
                <span className="gradient-text">₹{Math.round(price * 1.18).toLocaleString()}</span>
              </div>
            </div>

            <button className="btn btn-primary btn-large" style={{ width: "100%", marginTop: 24 }}>
              🔒 Pay ₹{Math.round(price * 1.18).toLocaleString()} & Upgrade
            </button>

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 12 }}>
              🔒 Secured by Stripe • Cancel anytime • 7-day money back guarantee
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
