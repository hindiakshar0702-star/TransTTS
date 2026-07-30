"use client";

import Link from "next/link";
import BentoCard from "./BentoCard";
import { SparklesIcon, ArrowRightIcon } from "./Icons";

export default function CTASection() {
  return (
    <section style={{ padding: "24px 0" }}>
      <div className="landing-container">
        <BentoCard className="cta-card">
          <h2 className="cta-title">
            Ready to Transform Audio?
          </h2>
          <p className="cta-desc">
            Experience accurate transcription, GPT translation, and premium AI voice generation — all in one unified platform.
          </p>
          <div className="cta-buttons">
            <Link href="/transcribe" className="hero-btn-primary" style={{ fontSize: "0.95rem", padding: "16px 32px", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <SparklesIcon size={16} color="#0a0a0a" />
              <span>Get Started Free</span>
            </Link>
            <Link
              href="/login"
              className="hero-btn-secondary"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: "0.95rem",
                padding: "16px 32px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <span>Sign In to Account</span>
              <ArrowRightIcon size={16} color="#ffffff" />
            </Link>
          </div>
        </BentoCard>
      </div>
    </section>
  );
}
