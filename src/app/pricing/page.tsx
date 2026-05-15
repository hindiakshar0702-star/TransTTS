import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "₹0",
      period: "forever",
      badge: "Current Plan",
      highlight: false,
      description: "Perfect for personal use & testing",
      features: [
        { text: "5 transcriptions / day", included: true },
        { text: "10,000 char translations", included: true },
        { text: "18 Neural TTS voices", included: true },
        { text: "Export TXT, SRT, VTT, JSON", included: true },
        { text: "Groq Whisper AI engine", included: true },
        { text: "Edge Neural TTS (free)", included: true },
        { text: "25 MB file size limit", included: true },
        { text: "History & Dashboard", included: true },
        { text: "Priority processing", included: false },
        { text: "API access", included: false },
      ],
      cta: "Get Started Free",
      ctaLink: "/transcribe",
    },
    {
      name: "Pro",
      price: "₹499",
      period: "/ month",
      badge: "Most Popular",
      highlight: true,
      description: "For content creators & professionals",
      features: [
        { text: "Unlimited transcriptions", included: true },
        { text: "Unlimited translations", included: true },
        { text: "18+ Neural TTS voices", included: true },
        { text: "All export formats + PDF", included: true },
        { text: "OpenAI Whisper + Groq", included: true },
        { text: "Premium HD voices", included: true },
        { text: "100 MB file size limit", included: true },
        { text: "History & Dashboard", included: true },
        { text: "Priority processing", included: true },
        { text: "API access", included: false },
      ],
      cta: "Upgrade to Pro",
      ctaLink: "/upgrade",
    },
    {
      name: "Enterprise",
      price: "₹2,999",
      period: "/ month",
      badge: "Best Value",
      highlight: false,
      description: "For teams & businesses at scale",
      features: [
        { text: "Everything in Pro", included: true },
        { text: "Unlimited everything", included: true },
        { text: "Custom neural voices", included: true },
        { text: "All formats + custom", included: true },
        { text: "Multi-engine AI pipeline", included: true },
        { text: "Ultra HD voice quality", included: true },
        { text: "500 MB file size limit", included: true },
        { text: "Team dashboard & analytics", included: true },
        { text: "Dedicated support", included: true },
        { text: "Full REST API access", included: true },
      ],
      cta: "Contact Sales",
      ctaLink: "/contact",
    },
  ];

  const faqs = [
    {
      q: "Is SpeechTrans AI really free?",
      a: "Yes! The Free plan gives you 5 transcriptions per day, unlimited translations, and access to all 18 Neural TTS voices — completely free, no credit card required.",
    },
    {
      q: "What AI engines do you use?",
      a: "We use Groq's Whisper Large V3 Turbo for transcription (free tier), MyMemory for translation, and Microsoft Edge Neural TTS for voice generation — all best-in-class.",
    },
    {
      q: "What audio/video formats are supported?",
      a: "MP3, WAV, M4A, OGG, FLAC, WebM, MP4, MKV, AVI, and 15+ more formats. We automatically extract audio from video files.",
    },
    {
      q: "How accurate is the transcription?",
      a: "OpenAI Whisper achieves 95%+ accuracy on clear audio. Performance varies with background noise, accents, and audio quality.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes! There are no contracts or commitments. Upgrade, downgrade, or cancel anytime. Your data stays accessible on the Free plan.",
    },
    {
      q: "Is my data secure?",
      a: "Absolutely. Files are processed in real-time and deleted immediately after transcription. We never store your audio files permanently.",
    },
  ];

  return (
    <>
      <Navbar />

      {/* Header */}
      <section className="section" style={{ paddingTop: 100 }}>
        <div className="container section-center">
          <div className="section-label">✦ Pricing</div>
          <h1 className="section-title" style={{ fontSize: "2.5rem" }}>
            Simple, <span className="gradient-text">Transparent</span> Pricing
          </h1>
          <p className="section-subtitle" style={{ maxWidth: 600 }}>
            Start free, upgrade when you need more. No hidden fees, no surprises.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="pricing-grid">
            {plans.map((plan) => (
              <div key={plan.name} className={`pricing-card ${plan.highlight ? "pricing-highlight" : ""}`}>
                <div className="pricing-badge-row">
                  <span className={`badge ${plan.highlight ? "badge-success" : "badge-info"}`}>{plan.badge}</span>
                </div>
                <h3 className="pricing-plan-name">{plan.name}</h3>
                <p className="pricing-desc">{plan.description}</p>
                <div className="pricing-price">
                  <span className="pricing-amount">{plan.price}</span>
                  <span className="pricing-period">{plan.period}</span>
                </div>

                <ul className="pricing-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className={f.included ? "included" : "excluded"}>
                      <span>{f.included ? "✅" : "—"}</span>
                      {f.text}
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
        </div>
      </section>

      {/* Comparison */}
      <section className="section">
        <div className="container section-center">
          <div className="section-label">✦ All Features</div>
          <h2 className="section-title">What&apos;s Included in Free</h2>
          <p className="section-subtitle">Everything you need to get started — no credit card required</p>

          <div className="free-features-grid">
            {[
              { icon: "🎤", title: "Whisper AI Transcription", desc: "Industry-leading accuracy via Groq" },
              { icon: "🌐", title: "25+ Language Translation", desc: "Hindi, English, Spanish, French & more" },
              { icon: "🔊", title: "18 Neural TTS Voices", desc: "Crystal-clear Microsoft Edge voices" },
              { icon: "📥", title: "Multi-format Export", desc: "TXT, SRT, VTT, JSON downloads" },
              { icon: "✏️", title: "Editable Transcript", desc: "Edit & refine before exporting" },
              { icon: "📊", title: "Dashboard & History", desc: "Track all your jobs in one place" },
              { icon: "🎛️", title: "Audio Waveform", desc: "Real-time frequency visualization" },
              { icon: "📱", title: "Fully Responsive", desc: "Works on desktop, tablet & mobile" },
            ].map((item) => (
              <div key={item.title} className="feature-card" style={{ textAlign: "center" }}>
                <div className="feature-icon">{item.icon}</div>
                <h3 style={{ fontSize: "0.95rem" }}>{item.title}</h3>
                <p style={{ fontSize: "0.82rem" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container section-center">
          <div className="section-label">✦ FAQ</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-question">{faq.q}</summary>
                <p className="faq-answer">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="glass-card" style={{ textAlign: "center", padding: "60px 32px" }}>
            <h2 className="section-title">Start Transcribing for Free</h2>
            <p style={{ color: "var(--text-dim)", marginBottom: 32, fontSize: "1.1rem" }}>
              No credit card needed. No trial period. Just upload and transcribe.
            </p>
            <div className="hero-actions">
              <Link href="/transcribe" className="btn btn-primary btn-large">
                🚀 Get Started Free
              </Link>
              <Link href="/dashboard" className="btn btn-outline btn-large">
                📊 View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <span>© 2026 SpeechTrans AI. All rights reserved.</span>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/transcribe">Transcribe</Link>
              <Link href="/translate">Translate</Link>
              <Link href="/tts">Voice</Link>
              <Link href="/pricing">Pricing</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
