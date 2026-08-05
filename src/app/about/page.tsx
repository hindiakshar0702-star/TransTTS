"use client";

import "../landing.css";
import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import {
  MicIcon, GlobeIcon, VolumeIcon, RadioIcon,
  ShieldIcon, LockIcon, SparklesIcon, TargetIcon, InfinityIcon,
} from "@/components/Icons";

const FEATURES = [
  { icon: RadioIcon, title: "Recorder", desc: "Capture crisp 48kHz audio right in the browser, with a live teleprompter to keep you on script." },
  { icon: MicIcon, title: "Transcribe", desc: "Turn speech into accurate text with Whisper AI — timestamps, segments, and multi-language support." },
  { icon: GlobeIcon, title: "Translate", desc: "Move transcripts across languages while keeping meaning and tone intact." },
  { icon: VolumeIcon, title: "Voice Generator", desc: "Generate natural, lifelike speech from any text with expressive neural voices." },
];

const VALUES = [
  { icon: LockIcon, title: "Privacy by default", desc: "Your audio and transcripts are yours. We process what we must and keep only what you ask us to." },
  { icon: ShieldIcon, title: "Built to be safe", desc: "Strict upload limits, input validation, and hardened auth protect every job from start to finish." },
  { icon: SparklesIcon, title: "Quality over noise", desc: "Fewer, sharper features that do one job well — not a pile of half-working tools." },
];

export default function AboutPage() {
  return (
    <div className="landing-page">
      <LandingNavbar />

      <main>
        {/* Hero */}
        <section className="landing-container" style={{ padding: "88px 0 24px", textAlign: "center", maxWidth: 820 }}>
          <span className="about-eyebrow">About TransTTS</span>
          <h1 className="about-title">
            One workspace for <span className="gradient-text">voice</span>, text, and everything between.
          </h1>
          <p className="about-lead">
            TransTTS is a translation and text-to-speech platform that helps you record, transcribe,
            translate, and voice your ideas — without stitching together five different tools.
          </p>
        </section>

        {/* Mission */}
        <section className="landing-container about-section">
          <div className="about-mission">
            <TargetIcon size={22} color="#FF8000" />
            <p>
              <strong>Our mission:</strong> make high-quality speech and language tools fast, private, and
              genuinely usable — so anyone can move between spoken and written words in any language.
            </p>
          </div>
        </section>

        {/* What it does */}
        <section className="landing-container about-section">
          <h2 className="about-h2">What TransTTS does</h2>
          <div className="about-grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="about-card">
                <span className="about-card-icon"><Icon size={22} color="#FF8000" /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="landing-container about-section">
          <h2 className="about-h2">What we care about</h2>
          <div className="about-grid about-grid--3">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="about-card">
                <span className="about-card-icon"><Icon size={22} color="#FF8000" /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team placeholder */}
        <section className="landing-container about-section">
          <div className="about-team">
            <InfinityIcon size={28} color="#FF8000" />
            <h2 className="about-h2" style={{ marginTop: 12 }}>Built by a small, focused team</h2>
            <p className="about-lead" style={{ margin: "0 auto" }}>
              We&apos;re a compact crew of engineers and designers who care about audio, language, and the
              details in between. This section is a placeholder — real team bios and photos land here soon.
            </p>
            <div style={{ marginTop: 24 }}>
              <Link href="/contact" className="btn btn-primary">Get in touch</Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
