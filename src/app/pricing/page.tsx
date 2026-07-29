import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PricingPage() {
  const features = [
    { icon: "🎤", title: "Whisper AI Transcription", desc: "5 free transcriptions every single day using Groq Whisper Large V3 Turbo" },
    { icon: "🌐", title: "Instant Translation", desc: "Translate transcripts into Hindi and 25+ other languages instantly" },
    { icon: "🔊", title: "Neural TTS Voice Generator", desc: "18+ natural Microsoft Edge voices with speed and pitch control" },
    { icon: "📥", title: "Multi-format Export", desc: "Download files as SRT, VTT, TXT, or JSON for subtitles or documents" },
    { icon: "📊", title: "Interactive Dashboard", desc: "Track and manage your history, jobs, and generated files in one place" },
    { icon: "⚡", title: "High Performance", desc: "Files processed in seconds via cloud-accelerated AI pipelines" },
    { icon: "🔒", title: "Privacy First", desc: "All files are processed in memory and deleted immediately after processing" },
    { icon: "📱", title: "Fully Responsive", desc: "Transcribe and translate on the go from your phone, tablet, or PC" },
  ];

  const faqs = [
    {
      q: "Is TransTTS AI really free?",
      a: "Yes! There are no paid plans, credit cards, or hidden fees. The Free Plan gives you access to transcription, translation, and text-to-speech with no upfront costs.",
    },
    {
      q: "What are the usage limits?",
      a: "To ensure fair usage for everyone, the Free Plan supports 5 transcriptions per day, up to 25MB file size limit per upload, and 10,000 characters per translation.",
    },
    {
      q: "Do you offer premium paid plans?",
      a: "Currently, TransTTS is entirely free to use. We don't offer premium plans, subscriptions, or upgrades, so everyone gets the best experience out-of-the-box.",
    },
    {
      q: "What audio/video formats are supported?",
      a: "We support MP3, WAV, M4A, OGG, FLAC, WebM, MP4, MKV, AVI, and many more. We automatically extract the audio from video files for processing.",
    },
    {
      q: "Is my data secure?",
      a: "Yes, your privacy is our top priority. Your audio and video files are processed in real-time and deleted immediately after processing. We do not store your files permanently.",
    },
  ];

  return (
    <>
      <Navbar />

      {/* Header */}
      <section className="section" style={{ paddingTop: 100 }}>
        <div className="container section-center">
          <div className="section-label">✦ Free Plan</div>
          <h1 className="section-title" style={{ fontSize: "2.5rem" }}>
            Enjoy TransTTS <span className="gradient-text">100% Free</span>
          </h1>
          <p className="section-subtitle" style={{ maxWidth: 600 }}>
            No subscriptions. No credit cards. No hidden fees. Just upload, transcribe, translate, and generate voice.
          </p>
        </div>
      </section>

      {/* Core Free Box */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <div className="glass-card pricing-highlight" style={{ textAlign: "center", padding: "48px 32px" }}>
            <span className="badge badge-success" style={{ marginBottom: 16, fontSize: "0.9rem", padding: "6px 16px" }}>Active Plan</span>
            <h2 className="pricing-plan-name" style={{ fontSize: "2.5rem", margin: "8px 0" }}>Free Tier</h2>
            <p className="pricing-desc" style={{ fontSize: "1.1rem", color: "var(--text-dim)" }}>Everything you need to transcribe, translate, and synthesize speech.</p>
            <div className="pricing-price" style={{ margin: "24px 0" }}>
              <span className="pricing-amount" style={{ fontSize: "4rem" }}>₹0</span>
              <span className="pricing-period">/ forever</span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "32px 0" }} />

            <div style={{ textAlign: "left", maxWidth: 500, margin: "0 auto" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: 16 }}>Included Limits & Features:</h3>
              <ul className="pricing-features" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
                <li className="included"><span>✅</span> 5 transcriptions / day (Groq Whisper Large V3)</li>
                <li className="included"><span>✅</span> 10,000 character translations / job</li>
                <li className="included"><span>✅</span> 18 Neural text-to-speech voices</li>
                <li className="included"><span>✅</span> Export as TXT, SRT, VTT, and JSON</li>
                <li className="included"><span>✅</span> Interactive dashboard & history logs</li>
                <li className="included"><span>✅</span> Up to 25 MB file size limit per upload</li>
              </ul>
            </div>

            <Link href="/transcribe" className="btn btn-primary btn-large" style={{ width: "100%", marginTop: 32, textAlign: "center" }}>
              🚀 Start Transcribing Free
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="section">
        <div className="container section-center">
          <div className="section-label">✦ All Features</div>
          <h2 className="section-title">Everything Included in Your Free Plan</h2>
          <p className="section-subtitle">A complete suite of AI-driven voice and transcription tools at your fingertips.</p>

          <div className="free-features-grid">
            {features.map((item) => (
              <div key={item.title} className="feature-card" style={{ textAlign: "center" }}>
                <div className="feature-icon">{item.icon}</div>
                <h3 style={{ fontSize: "0.95rem", margin: "12px 0 6px" }}>{item.title}</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>{item.desc}</p>
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

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <span>© 2026 TransTTS AI. All rights reserved.</span>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/transcribe">Transcribe</Link>
              <Link href="/translate">Translate</Link>
              <Link href="/tts">Voice</Link>
              <Link href="/pricing">Free Plan</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
