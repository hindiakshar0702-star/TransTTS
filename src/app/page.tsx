"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      if (loggedIn) {
        router.replace("/dashboard");
      } else {
        setIsChecking(false);
      }
    }
  }, [router]);

  if (isChecking) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />

      {/* HERO */}
      <section className="hero" style={{ padding: "160px 0 100px" }}>
        <div className="container">
          <div className="hero-badge fade-in">
            <span className="dot"></span>
            Powered by Whisper AI — Processing 99+ Languages
          </div>
          <h1 className="fade-in" style={{ fontSize: "clamp(2.8rem, 6vw, 4.8rem)", fontWeight: 900, marginBottom: "24px", lineHeight: "1.1" }}>
            Turn Every Word Into
            <br />
            <span className="gradient-text" style={{ paddingBottom: "8px", display: "inline-block" }}>Accurate Text — Instantly</span>
          </h1>
          <p className="subtitle fade-in" style={{ fontSize: "1.2rem", color: "var(--text-dim)", maxWidth: "680px", margin: "0 auto 40px", lineHeight: "1.8" }}>
            Next-gen AI transcription, GPT-based translation, and high-fidelity text-to-speech voice generation. All unified in a modular grid experience.
          </p>
          
          <div className="hero-actions fade-in" style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "64px" }}>
            <Link href="/transcribe" className="btn btn-primary btn-large">
              🎤 Start Transcribing Free
            </Link>
            <Link href="/login" className="btn btn-outline btn-large">
              📊 Open Personal Dashboard
            </Link>
          </div>

          <div className="hero-stats fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", maxWidth: "800px", margin: "0 auto", gap: "20px" }}>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <div className="stat-value" style={{ fontSize: "2.2rem", fontWeight: 800, background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>99+</div>
              <div className="stat-label" style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "4px" }}>Languages</div>
            </div>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <div className="stat-value" style={{ fontSize: "2.2rem", fontWeight: 800, background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>95%</div>
              <div className="stat-label" style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "4px" }}>Accuracy</div>
            </div>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <div className="stat-value" style={{ fontSize: "2.2rem", fontWeight: 800, background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>6</div>
              <div className="stat-label" style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "4px" }}>AI Voices</div>
            </div>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <div className="stat-value" style={{ fontSize: "2.2rem", fontWeight: 800, background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Free</div>
              <div className="stat-label" style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "4px" }}>To Start</div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO FEATURES GRID */}
      <section className="section" id="features" style={{ background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div className="section-label">✦ Features</div>
            <h2 className="section-title">Modular Audio Engine</h2>
            <p className="section-subtitle">A unified board built for translation, transcription, and speech synthesis.</p>
          </div>

          <div className="bento-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>

            {/* Box 1 (2 cols) */}
            <div className="glass-card" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
              <div>
                <span style={{ fontSize: "2rem", marginBottom: "16px", display: "block" }}>🎤</span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>Audio &amp; Video Transcription</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  Upload MP3, WAV, MP4, MKV and 20+ formats. Whisper AI parses the files with timestamped precision to create beautiful, ready-to-use transcripts.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <span className="badge badge-success">✓ 99.8% Whisper Success</span>
                <span className="badge badge-info">✓ Up to 25MB Files</span>
              </div>
            </div>

            {/* Box 2 (1 col) */}
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
              <div>
                <span style={{ fontSize: "2rem", marginBottom: "16px", display: "block" }}>🌍</span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>99+ Languages</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  Auto-detect and transcribe English, Hindi, Spanish, French, Japanese, and 94 more.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>🇮🇳 Hi</span>
                <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>🇺🇸 En</span>
                <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>🇪🇸 Es</span>
                <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>🇯🇵 Ja</span>
              </div>
            </div>

            {/* Box 3 (1 col) */}
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
              <div>
                <span style={{ fontSize: "2rem", marginBottom: "16px", display: "block" }}>🔄</span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>GPT Translation</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  Translate transcripts immediately to Hindi or any target language with advanced translation context preservation.
                </p>
              </div>
              <span className="badge badge-success" style={{ alignSelf: "flex-start" }}>Powered by GPT-4o</span>
            </div>

            {/* Box 4 (2 cols) */}
            <div className="glass-card" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
              <div>
                <span style={{ fontSize: "2rem", marginBottom: "16px", display: "block" }}>🔊</span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>Text-to-Speech Voice Generator</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  Generate high-fidelity AI voices from any script. Choose from 6 premium voices, adjust pitch and speed slider controls, and export directly as high quality MP3 audio.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <span className="badge badge-info">🎧 Swara (Female)</span>
                <span className="badge badge-info">🎧 Madhur (Male)</span>
                <span className="badge badge-info">🎧 Neer (Male)</span>
              </div>
            </div>

            {/* Box 5 (1 col) */}
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
              <div>
                <span style={{ fontSize: "2rem", marginBottom: "16px", display: "block" }}>⏱️</span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>srt Subtitles</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  Get word-level timestamps to generate subtitle files like SRT and VTT with single-click browser downloads.
                </p>
              </div>
              <span className="badge badge-info" style={{ alignSelf: "flex-start" }}>YouTube &amp; Premiere Ready</span>
            </div>

            {/* Box 6 (2 cols) */}
            <div className="glass-card" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
              <div>
                <span style={{ fontSize: "2rem", marginBottom: "16px", display: "block" }}>🎙️</span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>Live Voice Recorder &amp; Teleprompter</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  Record directly in your browser with real-time active noise suppression and a visual teleprompter that tracks and highlights spoken words dynamically.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <span className="badge badge-success">✓ Active Noise Cancellation</span>
                <span className="badge badge-info">✓ Speech Recognition Match</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="container section-center">
          <div className="section-label">✦ How It Works</div>
          <h2 className="section-title">Three Simple Steps</h2>
          <p className="section-subtitle">No technical knowledge required. Drag, record, or transcribe.</p>
          
          <div className="teleprompter-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", height: "auto", gap: "24px" }}>
            <div className="glass-card" style={{ padding: "32px 24px", height: "auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📂</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>1. Select or Record</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: "1.6" }}>
                Drag and drop your audio/video file, or speak directly into our live recorder with active noise cancellation.
              </p>
            </div>
            <div className="glass-card" style={{ padding: "32px 24px", height: "auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>⚙️</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>2. AI Processing</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: "1.6" }}>
                Our deep learning Whisper models process the audio, transcribing speech and aligning timestamps instantly.
              </p>
            </div>
            <div className="glass-card" style={{ padding: "32px 24px", height: "auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📥</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>3. Export &amp; Translate</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: "1.6" }}>
                Translate your transcripts, generate high-fidelity AI voice files, or export SRT subtitles in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingBottom: "100px" }}>
        <div className="container">
          <div className="glass-card" style={{ textAlign: "center", padding: "64px 32px", background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent), var(--bg-card)" }}>
            <h2 className="section-title" style={{ fontSize: "2.2rem", marginBottom: "12px" }}>Ready to Transform Audio?</h2>
            <p style={{ color: "var(--text-dim)", marginBottom: "32px", fontSize: "1.05rem" }}>
              Experience accurate transcription and speech synthesis in one unified modular platform.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <Link href="/transcribe" className="btn btn-primary btn-large">
                🚀 Get Started Free
              </Link>
              <Link href="/login" className="btn btn-outline btn-large">
                Sign In to Account
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
            <div style={{ display: "flex", gap: "16px" }}>
              <Link href="/transcribe">Transcribe</Link>
              <Link href="/translate">Translate</Link>
              <Link href="/tts">Voice Generator</Link>
              <Link href="/pricing">Free Plan</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
