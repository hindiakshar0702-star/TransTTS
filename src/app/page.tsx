import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">
            <span className="dot"></span>
            Powered by OpenAI Whisper — Now in 99+ Languages
          </div>
          <h1>
            Turn Every Word Into
            <br />
            <span className="gradient-text">Accurate Text — Instantly</span>
          </h1>
          <p className="subtitle">
            AI-powered transcription for audio &amp; video. Translate to Hindi &amp; 99+
            languages, then generate natural AI voice — all in one platform.
          </p>
          <div className="hero-actions">
            <Link href="/transcribe" className="btn btn-primary btn-large">
              🎤 Start Transcribing Free
            </Link>
            <Link href="/tts" className="btn btn-outline btn-large">
              🔊 Try Voice Generator
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-value">99+</div>
              <div className="stat-label">Languages</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">95%</div>
              <div className="stat-label">Accuracy</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">6</div>
              <div className="stat-label">AI Voices</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">Free</div>
              <div className="stat-label">To Start</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="container section-center">
          <div className="section-label">✦ Features</div>
          <h2 className="section-title">Complete AI Audio Pipeline</h2>
          <p className="section-subtitle">
            From upload to voice generation — transcribe, translate, and speak in any language.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎤</div>
              <h3>Audio &amp; Video Transcription</h3>
              <p>Upload MP3, WAV, MP4, MKV and 20+ formats. Whisper AI transcribes with industry-leading accuracy.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌍</div>
              <h3>99+ Languages</h3>
              <p>Transcribe in Hindi, English, Spanish, French, Japanese, Arabic and 93 more with auto-detection.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Instant Translation</h3>
              <p>Translate transcripts to Hindi and 25+ languages. Powered by GPT-4o with free fallback.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔊</div>
              <h3>AI Voice Generator</h3>
              <p>Convert any text to natural speech. 6 premium voices with speed control. Download as MP3.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <h3>Timestamped Segments</h3>
              <p>Get word-level timestamps for perfect subtitles. Export as SRT or VTT for any video platform.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📥</div>
              <h3>Multiple Exports</h3>
              <p>Download transcripts as TXT, SRT subtitles, or copy directly. Everything works in your browser.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="container section-center">
          <div className="section-label">✦ How It Works</div>
          <h2 className="section-title">Three Simple Steps</h2>
          <p className="section-subtitle">No technical knowledge required. Upload, process, download.</p>
          <div className="features-grid" style={{ maxWidth: 900, margin: "0 auto" }}>
            <div className="feature-card" style={{ textAlign: "center" }}>
              <div className="feature-icon">📂</div>
              <h3>1. Upload File</h3>
              <p>Drag &amp; drop any audio or video file. We support MP3, WAV, MP4, MKV and more up to 25MB.</p>
            </div>
            <div className="feature-card" style={{ textAlign: "center" }}>
              <div className="feature-icon">🤖</div>
              <h3>2. AI Processes</h3>
              <p>Whisper AI transcribes your audio. Then translate or generate voice with one click.</p>
            </div>
            <div className="feature-card" style={{ textAlign: "center" }}>
              <div className="feature-icon">✅</div>
              <h3>3. Download</h3>
              <p>Get your transcript, translation, or AI-generated voice. Export in multiple formats.</p>
            </div>
          </div>
        </div>
      </section>

      {/* LANGUAGES */}
      <section className="section">
        <div className="container section-center">
          <div className="section-label">✦ Languages</div>
          <h2 className="section-title">Optimized for Hindi &amp; English</h2>
          <p className="section-subtitle">First-class support for Hindi-English, plus 97 more languages.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 700, margin: "0 auto" }}>
            {[
              "🇮🇳 Hindi", "🇺🇸 English", "🇪🇸 Spanish", "🇫🇷 French", "🇩🇪 German",
              "🇯🇵 Japanese", "🇨🇳 Chinese", "🇸🇦 Arabic", "🇧🇷 Portuguese", "🇰🇷 Korean",
              "🇮🇹 Italian", "🇷🇺 Russian", "🇹🇷 Turkish", "🇳🇱 Dutch", "🇵🇱 Polish",
            ].map((lang, i) => (
              <span key={lang} className="badge badge-info" style={{
                padding: "8px 16px", fontSize: "0.85rem",
                ...(i < 2 ? { background: "rgba(99,102,241,0.2)", borderColor: "var(--accent)" } : {}),
              }}>
                {lang}
              </span>
            ))}
            <span className="badge badge-info" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
              + 84 More
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="glass-card" style={{ textAlign: "center", padding: "60px 32px" }}>
            <h2 className="section-title">Ready to Transform Audio?</h2>
            <p style={{ color: "var(--text-dim)", marginBottom: 32, fontSize: "1.1rem" }}>
              Transcribe, translate, and generate voice — completely free to start.
            </p>
            <div className="hero-actions">
              <Link href="/transcribe" className="btn btn-primary btn-large">
                🚀 Start Transcribing Free
              </Link>
              <Link href="/translate" className="btn btn-outline btn-large">
                🌐 Try Translation
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <span>© 2026 TransTTS AI. All rights reserved.</span>
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
