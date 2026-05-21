"use client";
import { Fragment, useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Cycle = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number; // total per year
  highlight?: boolean;
  badge?: string;
  cta: string;
  ctaLink: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try out everything risk-free",
    monthly: 0,
    yearly: 0,
    badge: "Forever Free",
    cta: "Get Started Free",
    ctaLink: "/transcribe",
    features: [
      "30 min transcription / month",
      "5,000 chars translation / month",
      "5,000 chars TTS / month",
      "18 Neural voices",
      "5 min noise removal / month",
      "25 MB file size limit",
      "TXT, SRT, VTT, JSON exports",
      "Browser-based, no install",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For students & solo creators",
    monthly: 299,
    yearly: 2499,
    cta: "Start Starter",
    ctaLink: "/upgrade?plan=starter",
    features: [
      "5 hours transcription / month",
      "100,000 chars translation",
      "100,000 chars TTS",
      "1 Voice Clone (your voice)",
      "60 min noise removal",
      "100 MB file size limit",
      "HD audio quality",
      "All export formats + PDF",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For content creators & podcasters",
    monthly: 999,
    yearly: 8499,
    highlight: true,
    badge: "Most Popular",
    cta: "Upgrade to Pro",
    ctaLink: "/upgrade?plan=pro",
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
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For teams & businesses at scale",
    monthly: 2999,
    yearly: 25999,
    badge: "Best Value",
    cta: "Contact Sales",
    ctaLink: "/contact",
    features: [
      "Unlimited transcription",
      "Unlimited translation",
      "Unlimited TTS",
      "Unlimited Voice Clones",
      "Unlimited noise removal",
      "500 MB file size limit",
      "Custom voice training",
      "Full REST API access",
      "Team accounts (10 seats)",
      "Dedicated account manager",
      "99.9% SLA",
      "On-premise option",
    ],
  },
];

interface ComparisonRow {
  label: string;
  values: [string | boolean, string | boolean, string | boolean, string | boolean];
}
interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
}

const COMPARISON: ComparisonSection[] = [
  {
    title: "Transcription",
    rows: [
      { label: "Monthly minutes", values: ["30 min", "5 hours", "25 hours", "Unlimited"] },
      { label: "File size limit", values: ["25 MB", "100 MB", "200 MB", "500 MB"] },
      { label: "99+ language support", values: [true, true, true, true] },
      { label: "Speaker diarization", values: [false, true, true, true] },
      { label: "Timestamp accuracy", values: ["Word-level", "Word-level", "Word-level", "Word-level"] },
      { label: "Whisper Large V3 Turbo", values: [true, true, true, true] },
    ],
  },
  {
    title: "Translation",
    rows: [
      { label: "Monthly characters", values: ["5K", "100K", "500K", "Unlimited"] },
      { label: "25+ languages", values: [true, true, true, true] },
      { label: "GPT-4o premium engine", values: [false, false, true, true] },
      { label: "Bulk file translation", values: [false, false, true, true] },
    ],
  },
  {
    title: "Voice Generation (TTS)",
    rows: [
      { label: "Monthly characters", values: ["5K", "100K", "500K", "Unlimited"] },
      { label: "Neural voices", values: ["18", "18", "30+", "30+ + Custom"] },
      { label: "HD audio quality", values: [false, true, true, true] },
      { label: "Emotion control", values: [false, false, true, true] },
      { label: "Multi-speaker dialogue", values: [false, false, true, true] },
      { label: "SSML support", values: [false, true, true, true] },
    ],
  },
  {
    title: "Voice Cloning",
    rows: [
      { label: "Voice clones included", values: ["—", "1", "5", "Unlimited"] },
      { label: "Cloning quality", values: ["—", "Standard", "Premium", "Studio + Custom training"] },
      { label: "Multi-language clones", values: ["—", true, true, true] },
      { label: "Consent verification", values: [true, true, true, true] },
    ],
  },
  {
    title: "Noise Removal",
    rows: [
      { label: "Monthly minutes", values: ["5 min", "60 min", "5 hours", "Unlimited"] },
      { label: "Voice isolation mode", values: [false, true, true, true] },
      { label: "Strength control", values: [false, true, true, true] },
      { label: "Auto-process pipeline", values: [false, false, true, true] },
    ],
  },
  {
    title: "Platform & Support",
    rows: [
      { label: "Dashboard & history", values: [true, true, true, true] },
      { label: "All export formats", values: [true, true, true, true] },
      { label: "API access", values: [false, false, "Limited (1K calls/day)", "Full + webhooks"] },
      { label: "Team accounts", values: [false, false, false, "10 seats"] },
      { label: "Priority processing", values: [false, false, true, true] },
      { label: "Support channel", values: ["Community", "Email", "Email + Chat", "Dedicated manager"] },
      { label: "SLA uptime", values: [false, false, false, "99.9%"] },
    ],
  },
];

const USE_CASES = [
  {
    icon: "🎓",
    title: "Students",
    desc: "Lecture transcription, multilingual notes, exam prep audio",
    tag: "Free or Starter",
  },
  {
    icon: "🎙️",
    title: "Podcasters",
    desc: "Auto-transcribe episodes, clone your voice for ads, clean audio",
    tag: "Pro",
  },
  {
    icon: "📺",
    title: "YouTubers",
    desc: "Subtitles in 99 languages, dub videos with cloned voice, denoise",
    tag: "Pro",
  },
  {
    icon: "🏢",
    title: "Businesses",
    desc: "Meeting transcripts, multilingual customer support, branded voice AI",
    tag: "Enterprise",
  },
];

const FAQS = [
  {
    q: "Is the Free plan really forever free?",
    a: "Yes — no credit card needed, no trial expiry. The Free plan gives you 30 min transcription, 5K characters of translation/TTS, and 5 min noise removal per month. Forever.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We use Razorpay so you can pay via UPI, debit/credit card (Visa, Mastercard, RuPay, Amex), net banking, or wallets (Paytm, PhonePe, Google Pay). For Enterprise we also accept bank transfer and invoicing.",
  },
  {
    q: "Are taxes included in the price?",
    a: "Prices shown are exclusive of GST. 18% GST will be added at checkout for Indian customers. Businesses can claim ITC with their GSTIN.",
  },
  {
    q: "Can I switch plans anytime?",
    a: "Yes — upgrade anytime and the new limits apply immediately (we prorate the difference). Downgrades take effect at the end of your current billing cycle. No lock-ins.",
  },
  {
    q: "How does voice cloning work?",
    a: "Upload a 30-60 second clean voice sample. Our AI creates a voice profile within minutes. You can then generate unlimited speech in that voice in any supported language. We require explicit consent — you must own the voice or have written permission.",
  },
  {
    q: "What if I exceed my monthly limit?",
    a: "On Free and Starter, processing pauses until next month. On Pro you get 20% overage at standard rates. On Enterprise there are no limits. You'll get email alerts at 75%, 90%, and 100% usage.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes — 7-day money-back guarantee on all paid plans, no questions asked. After 7 days, refunds are pro-rated for unused time on annual plans.",
  },
  {
    q: "Is my audio data private?",
    a: "Absolutely. Files are processed and deleted within 24 hours. We never train models on your data. Enterprise plans get optional on-premise deployment for full data sovereignty.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — cancel from your dashboard with one click. No phone calls, no retention pitches. Your data stays accessible for 30 days after cancellation.",
  },
  {
    q: "Do you offer student / NGO discounts?",
    a: "Yes! Students get 50% off Starter with valid .edu / .ac.in email. NGOs and educational institutions get up to 70% off Pro. Email us at hello@transtts.ai with verification.",
  },
];

function renderValue(v: string | boolean) {
  if (v === true) return <span className="compare-check">✓</span>;
  if (v === false) return <span className="compare-cross">—</span>;
  return <span style={{ fontSize: "0.85rem" }}>{v}</span>;
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const formatPrice = (plan: Plan) => {
    if (plan.monthly === 0) return "₹0";
    if (cycle === "monthly") return `₹${plan.monthly.toLocaleString()}`;
    return `₹${Math.round(plan.yearly / 12).toLocaleString()}`;
  };

  const formatPeriod = () => (cycle === "monthly" ? "/ month" : "/ month, billed yearly");

  const yearlySaving = (plan: Plan) => {
    if (plan.monthly === 0) return 0;
    const saved = plan.monthly * 12 - plan.yearly;
    return Math.round((saved / (plan.monthly * 12)) * 100);
  };

  return (
    <>
      <Navbar />

      {/* ===== HERO ===== */}
      <section className="section" style={{ paddingTop: 100, paddingBottom: 40 }}>
        <div className="container section-center">
          <div className="section-label">✦ Pricing</div>
          <h1 className="section-title" style={{ fontSize: "2.5rem" }}>
            Simple, <span className="gradient-text">Transparent</span> Pricing
          </h1>
          <p className="section-subtitle" style={{ maxWidth: 640 }}>
            Start free. Upgrade when you grow. Cancel anytime.
            All plans include Hindi-first AI built for Indian creators.
          </p>

          {/* Billing toggle */}
          <div className="pricing-controls">
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
                Yearly <span className="save-badge">Save up to 30%</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING CARDS ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`pricing-card ${plan.highlight ? "pricing-highlight" : ""}`}
              >
                <div className="pricing-badge-row">
                  {plan.badge && (
                    <span
                      className={
                        plan.highlight
                          ? "tier-badge-popular"
                          : `badge ${plan.id === "enterprise" ? "badge-success" : "badge-info"}`
                      }
                    >
                      {plan.highlight ? "⭐ " : ""}{plan.badge}
                    </span>
                  )}
                </div>

                <h3 className="pricing-plan-name">{plan.name}</h3>
                <p className="pricing-desc">{plan.tagline}</p>

                <div className="pricing-price">
                  <span className="pricing-amount">{formatPrice(plan)}</span>
                  {plan.monthly > 0 && (
                    <span className="pricing-period">{formatPeriod()}</span>
                  )}
                  {cycle === "yearly" && plan.monthly > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <span className="save-badge">Save {yearlySaving(plan)}%</span>
                    </div>
                  )}
                  {plan.monthly === 0 && <span className="pricing-period">forever</span>}
                </div>

                <ul className="pricing-features">
                  {plan.features.map((f) => (
                    <li key={f} className="included">
                      <span>✅</span> {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaLink}
                  className={`btn ${plan.highlight ? "btn-primary" : "btn-outline"} btn-large`}
                  style={{ width: "100%", textAlign: "center" }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Payment methods */}
          <div className="section-center" style={{ marginTop: 40 }}>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 8 }}>
              🔒 Secure checkout via Razorpay • GST invoices • Cancel anytime
            </p>
            <div className="payment-methods">
              <span className="payment-method">📱 UPI</span>
              <span className="payment-method">💳 Cards</span>
              <span className="payment-method">🏦 Net Banking</span>
              <span className="payment-method">📲 Paytm</span>
              <span className="payment-method">💰 PhonePe</span>
              <span className="payment-method">G Pay</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== USE CASES ===== */}
      <section className="section">
        <div className="container section-center">
          <div className="section-label">✦ Who Is It For</div>
          <h2 className="section-title">Built for Every Creator</h2>
          <p className="section-subtitle">Not sure which plan? Here&apos;s what we recommend:</p>

          <div className="usecase-grid">
            {USE_CASES.map((u) => (
              <div key={u.title} className="usecase-card">
                <div className="usecase-icon">{u.icon}</div>
                <div className="usecase-title">{u.title}</div>
                <div className="usecase-desc">{u.desc}</div>
                <span className="usecase-tag">{u.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="section">
        <div className="container">
          <div className="section-center" style={{ marginBottom: 32 }}>
            <div className="section-label">✦ Full Comparison</div>
            <h2 className="section-title">Compare All Features</h2>
            <p className="section-subtitle">Everything you get in each plan</p>
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th></th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={p.highlight ? "highlight" : ""}>
                      <div className="plan-name">{p.name}</div>
                      <div className="plan-sub">
                        {p.monthly === 0
                          ? "Free"
                          : `₹${(cycle === "monthly" ? p.monthly : Math.round(p.yearly / 12)).toLocaleString()}/mo`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((section) => (
                  <Fragment key={section.title}>
                    <tr className="row-section">
                      <td colSpan={5}>{section.title}</td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        {row.values.map((val, idx) => (
                          <td key={idx}>{renderValue(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section" id="faq">
        <div className="container section-center">
          <div className="section-label">✦ FAQ</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>
            Got more questions? <Link href="/contact" style={{ color: "var(--accent)" }}>Contact us</Link>
          </p>

          <div className="faq-list">
            {FAQS.map((faq, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-question">{faq.q}</summary>
                <p className="faq-answer">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRUST / GUARANTEE ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="glass-card" style={{ textAlign: "center", padding: "48px 32px", maxWidth: 800, margin: "0 auto" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🛡️</div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 12 }}>
              7-Day Money-Back Guarantee
            </h3>
            <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: "0.95rem" }}>
              Try any paid plan risk-free. If you&apos;re not satisfied within 7 days, we&apos;ll refund your full payment — no questions asked.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              <span className="badge badge-success">✅ No hidden fees</span>
              <span className="badge badge-success">✅ Cancel anytime</span>
              <span className="badge badge-success">✅ GST invoices</span>
              <span className="badge badge-success">✅ Made in India 🇮🇳</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="section">
        <div className="container">
          <div className="glass-card" style={{ textAlign: "center", padding: "60px 32px" }}>
            <h2 className="section-title">Ready to Get Started?</h2>
            <p style={{ color: "var(--text-dim)", marginBottom: 32, fontSize: "1.05rem" }}>
              Start with the Free plan today. Upgrade only when you need more.
            </p>
            <div className="hero-actions">
              <Link href="/transcribe" className="btn btn-primary btn-large">
                🚀 Start Free — No Card Needed
              </Link>
              <Link href="/contact" className="btn btn-outline btn-large">
                💬 Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <span>© 2026 TransTTS AI. All rights reserved. Made with ❤️ in India.</span>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/transcribe">Transcribe</Link>
              <Link href="/translate">Translate</Link>
              <Link href="/tts">Voice</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
