"use client";

import BentoCard from "./BentoCard";
import { MAX_UPLOAD_MB } from "@/lib/utils";
import {
  MicIcon, GlobeIcon, VolumeIcon, RadioIcon, SubtitlesIcon,
  SparklesIcon, CheckCircleIcon, ArrowRightIcon, HeadphonesIcon
} from "./Icons";

export default function BentoGrid() {
  return (
    <section className="bento-section" id="features">
      <div className="landing-container">
        <div className="landing-grid">
          {/* ===== ROW 1: 3 Equal Cards (4+4+4) ===== */}

          {/* Card 1: Transcribe Easily */}
          <BentoCard span={4} delay={0}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Transcribe Easily</h3>
                <a href="#features" style={{ fontSize: "0.75rem", color: "var(--color-landing-text-dim)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>See all</span>
                  <ArrowRightIcon size={12} color="var(--color-landing-text-dim)" />
                </a>
              </div>

              <div className="user-card">
                <div className="user-card-avatar" style={{ background: "linear-gradient(135deg, #FF9933, #FF5500)", color: "#0a0a0a" }}>
                  <MicIcon size={18} color="#0a0a0a" />
                </div>
                <div className="user-card-info">
                  <h4>Savannah Nguyen</h4>
                  <p>Uploaded 3 podcasts today</p>
                </div>
              </div>
              <div className="user-card">
                <div className="user-card-avatar" style={{ background: "linear-gradient(135deg, #e8e4ff, #c5d1ff)", color: "#5c62ec" }}>
                  <GlobeIcon size={18} color="#5c62ec" />
                </div>
                <div className="user-card-info">
                  <h4>Brooklyn Simmons</h4>
                  <p>Translated to 5 languages</p>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 2: AI Voice Platform (Accent) */}
          <BentoCard span={4} variant="accent" delay={0.08}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", minHeight: 200 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, opacity: 0.7 }}>
                Powered by AI
              </div>
              <h3 style={{ fontSize: "1.8rem", fontWeight: 900, lineHeight: 1.15, marginBottom: 12 }}>
                AI Voice
                <br />
                Platform!
              </h3>
              <p style={{ fontSize: "0.82rem", lineHeight: 1.5, opacity: 0.75 }}>
                Whisper + GPT-4o engine for transcription, translation, and voice synthesis.
              </p>
              <div style={{ marginTop: 20 }}>
                <div className="waveform-decoration">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="waveform-bar" style={{ background: "rgba(10,10,10,0.5)" }} />
                  ))}
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 3: Grow Your Reach (Dark) */}
          <BentoCard span={4} variant="dark" delay={0.16}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: 200 }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 8, lineHeight: 1.2 }}>
                  Grow your reach with
                  <br />
                  <span style={{ color: "var(--color-landing-accent)" }}>No boundary at all</span>
                </h3>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                  99+ languages, unlimited potential.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <span className="landing-badge landing-badge-accent" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircleIcon size={12} color="#0a0a0a" /> Whisper AI
                </span>
                <span className="landing-badge" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <SparklesIcon size={12} color="#FF8000" /> GPT-4o
                </span>
              </div>
              <div style={{ position: "absolute", top: -20, right: -20, display: "flex", gap: 8, opacity: 0.15 }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", border: "2px solid #fff" }} />
                <div style={{ width: 60, height: 60, borderRadius: "50%", border: "2px solid #fff", marginTop: 20 }} />
              </div>
            </div>
          </BentoCard>

          {/* ===== ROW 2: 2 Medium Cards (7+5) ===== */}

          {/* Card 4: Audio & Video Transcription */}
          <BentoCard span={7} delay={0}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 220 }}>
              <div>
                <div className="feature-icon-circle" style={{ background: "rgba(99,102,241,0.08)" }}>
                  <MicIcon size={22} color="#6366f1" />
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 8 }}>Audio & Video Transcription</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-landing-text-dim)", lineHeight: 1.7, maxWidth: 420 }}>
                  Upload MP3, WAV, MP4, MKV and 20+ formats. Whisper AI parses files with timestamped precision to create beautiful, ready-to-use transcripts.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <span className="landing-badge landing-badge-success">✓ 99.8% Whisper Success</span>
                <span className="landing-badge landing-badge-info">✓ Up to {MAX_UPLOAD_MB}MB Files</span>
              </div>
            </div>
          </BentoCard>

          {/* Card 5: GPT Translation */}
          <BentoCard span={5} delay={0.08}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 220 }}>
              <div>
                <div className="feature-icon-circle" style={{ background: "rgba(16,185,129,0.08)" }}>
                  <GlobeIcon size={22} color="#10b981" />
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 8 }}>GPT Translation</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-landing-text-dim)", lineHeight: 1.7 }}>
                  Translate transcripts instantly to Hindi or any target language with advanced context preservation.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
                <span className="landing-badge landing-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <img src="/flags/in.svg" alt="IN" className="landing-flag-img" />
                  <span>Hindi</span>
                </span>
                <span className="landing-badge landing-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <img src="/flags/us.svg" alt="US" className="landing-flag-img" />
                  <span>English</span>
                </span>
                <span className="landing-badge landing-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <img src="/flags/es.svg" alt="ES" className="landing-flag-img" />
                  <span>Spanish</span>
                </span>
                <span className="landing-badge landing-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <img src="/flags/jp.svg" alt="JP" className="landing-flag-img" />
                  <span>Japanese</span>
                </span>
              </div>
            </div>
          </BentoCard>

          {/* ===== ROW 3: 1 Large Wide Card (12) ===== */}

          {/* Card 6: TTS Voice Generator */}
          <BentoCard span={12} delay={0}>
            <div className="bento-tts-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
              <div>
                <div className="feature-icon-circle" style={{ background: "rgba(245,158,11,0.08)" }}>
                  <VolumeIcon size={22} color="#f59e0b" />
                </div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 10 }}>Text-to-Speech Voice Generator</h3>
                <p style={{ fontSize: "0.95rem", color: "var(--color-landing-text-dim)", lineHeight: 1.7, marginBottom: 20 }}>
                  Generate high-fidelity AI voices from any script. Choose from 6 premium voices, adjust pitch and speed, and export directly as high quality MP3 audio.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Alloy", "Echo", "Nova", "Shimmer", "Onyx", "Fable"].map(v => (
                    <span key={v} className="landing-badge landing-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <HeadphonesIcon size={12} color="#6366f1" /> {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Voice preview UI */}
              <div style={{
                background: "var(--color-landing-card-alt)",
                borderRadius: 20, padding: 28,
                border: "1px solid var(--color-landing-border)"
              }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: "var(--color-landing-accent)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <VolumeIcon size={20} color="#0a0a0a" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Now Playing</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-landing-text-dim)" }}>Alloy Voice — Hindi</div>
                    </div>
                  </div>

                  <div className="waveform-decoration" style={{ height: 60, gap: 3 }}>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="waveform-bar" style={{
                        height: `${20 + Math.sin(i * 0.8) * 30 + 15}%`,
                        animationDelay: `${i * 0.06}s`,
                        background: i < 12 ? "var(--color-landing-accent)" : "var(--color-landing-border)",
                      }} />
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--color-landing-text-muted)" }}>1:24</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--color-landing-text-muted)" }}>3:48</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Alloy", "Echo", "Nova"].map((v, i) => (
                    <div key={v} style={{
                      padding: "6px 14px", borderRadius: 10,
                      fontSize: "0.72rem", fontWeight: 600,
                      background: i === 0 ? "var(--color-landing-accent-dark)" : "var(--color-landing-card)",
                      color: i === 0 ? "#fff" : "var(--color-landing-text-dim)",
                      border: `1px solid ${i === 0 ? "transparent" : "var(--color-landing-border)"}`,
                    }}>{v}</div>
                  ))}
                </div>
              </div>
            </div>
          </BentoCard>

          {/* ===== ROW 4: 3 Feature Cards (4+4+4) ===== */}

          {/* Card 7: Live Voice Recorder */}
          <BentoCard span={4} delay={0}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
              <div>
                <div className="feature-icon-circle" style={{ background: "rgba(239,68,68,0.08)" }}>
                  <RadioIcon size={22} color="#ef4444" />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 8 }}>Live Voice Recorder</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-landing-text-dim)", lineHeight: 1.6 }}>
                  Record directly in your browser with real-time noise suppression and teleprompter tracking.
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                <span className="landing-badge landing-badge-success">✓ Noise Cancel</span>
                <span className="landing-badge landing-badge-info">✓ Teleprompter</span>
              </div>
            </div>
          </BentoCard>

          {/* Card 8: SRT Subtitles */}
          <BentoCard span={4} delay={0.08}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
              <div>
                <div className="feature-icon-circle" style={{ background: "rgba(6,182,212,0.08)" }}>
                  <SubtitlesIcon size={22} color="#06b6d4" />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 8 }}>SRT Subtitles</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-landing-text-dim)", lineHeight: 1.6 }}>
                  Get word-level timestamps to generate SRT and VTT subtitle files with single-click downloads.
                </p>
              </div>
              <span className="landing-badge landing-badge-info" style={{ alignSelf: "flex-start", marginTop: 16 }}>
                YouTube & Premiere Ready
              </span>
            </div>
          </BentoCard>

          {/* Card 9: 99+ Languages */}
          <BentoCard span={4} delay={0.16}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
              <div>
                <div className="feature-icon-circle" style={{ background: "rgba(139,92,246,0.08)" }}>
                  <GlobeIcon size={22} color="#8b5cf6" />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 8 }}>99+ Languages</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-landing-text-dim)", lineHeight: 1.6 }}>
                  Auto-detect and transcribe English, Hindi, Spanish, French, Japanese, and 94 more languages.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
                {[
                  { code: "in", label: "Hi" },
                  { code: "us", label: "En" },
                  { code: "es", label: "Es" },
                  { code: "jp", label: "Ja" },
                  { code: "fr", label: "Fr" },
                ].map((item) => (
                  <span key={item.code} className="landing-badge landing-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", padding: "5px 10px" }}>
                    <img src={`/flags/${item.code}.svg`} alt={item.code} className="landing-flag-img" />
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
