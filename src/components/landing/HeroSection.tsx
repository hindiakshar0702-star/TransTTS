"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MicIcon, GlobeIcon, VolumeIcon, ArrowRightIcon, FileTextIcon } from "./Icons";

export default function HeroSection() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (left) {
      left.style.opacity = "0";
      left.style.transform = "translateX(-40px)";
      left.style.transition = "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)";
      requestAnimationFrame(() => { left.style.opacity = "1"; left.style.transform = "translateX(0)"; });
    }
    if (right) {
      right.style.opacity = "0";
      right.style.transform = "translateX(40px)";
      right.style.transition = "opacity 0.7s 0.15s cubic-bezier(0.16,1,0.3,1), transform 0.7s 0.15s cubic-bezier(0.16,1,0.3,1)";
      requestAnimationFrame(() => { right.style.opacity = "1"; right.style.transform = "translateX(0)"; });
    }
  }, []);

  return (
    <section className="hero-section">
      <div className="landing-container">
        <div className="landing-grid">
          {/* ===== LEFT HERO CARD ===== */}
          <div ref={leftRef} className="bento-card hero-card-left">
            <div>
              <h1 className="hero-title">
                Free AI Text to
                <br />
                Speech &amp; Voice
                <br />
                Generator
              </h1>

              <p className="hero-desc">
                Convert your text into natural-sounding AI voices with TransTTS.
                Generate Hindi, English and multilingual speech online — quickly
                and free. You can also transcribe audio and translate across 25+
                languages.
              </p>

              <div className="hero-actions">
                <Link href="/dashboard" className="hero-btn-primary">
                  <span>Get Started</span>
                  <ArrowRightIcon size={16} color="#0a0a0a" />
                </Link>
              </div>
            </div>

            {/* Left: a true capability figure. Right: what the tool does,
                stated as features rather than invented users. */}
            <div className="hero-bento-subgrid">
              <div className="stat-bento-card">
                <div className="stat-bento-header">
                  <h3 className="stat-bento-title">18 voices</h3>
                  <div className="live-status-badge">
                    <span className="live-dot" />
                    <span className="live-text">Free</span>
                  </div>
                </div>
                <p className="stat-bento-desc">
                  natural AI voices<br />across 15+ languages
                </p>
              </div>

              <div className="user-cards-stack">
                <div className="bento-user-card">
                  <div className="user-card-avatar-circle">
                    <VolumeIcon size={18} color="#5c62ec" />
                  </div>
                  <div className="user-card-details">
                    <h4 className="user-card-name">Text to Speech</h4>
                    <p className="user-card-role">Hindi, English &amp; multilingual voices</p>
                  </div>
                </div>
                <div className="bento-user-card">
                  <div className="user-card-avatar-circle">
                    <GlobeIcon size={18} color="#5c62ec" />
                  </div>
                  <div className="user-card-details">
                    <h4 className="user-card-name">Transcribe &amp; Translate</h4>
                    <p className="user-card-role">Whisper AI across 99+ languages</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT SHOWCASE CARD ===== */}
          <div ref={rightRef} className="bento-card hero-card-right">
            <div className="showcase-inner">
              {/* Mini icon top right */}
              <div style={{ position: "absolute", top: 16, right: 20, zIndex: 3 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <MicIcon size={16} color="#1a1a1a" />
                </div>
              </div>

              {/* Phone mockup */}
              <div className="showcase-phone">
                <div className="showcase-phone-screen">
                  {/* Top bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <img src="/logo.svg" alt="TransTTS" style={{ height: 16, width: "auto" }} />
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#047857" }}>● Online</div>
                  </div>

                  {/* Sample of the real TTS input state, not a global metric. */}
                  <div className="showcase-balance">
                    <div className="showcase-balance-label">Characters</div>
                    <div className="showcase-balance-value">0 / 5,000</div>
                  </div>

                  {/* Quick actions */}
                  <div className="showcase-actions-grid">
                    <div className="showcase-action-item">
                      <div className="showcase-action-icon" style={{ display: "flex", justifyContent: "center" }}>
                        <MicIcon size={16} color="#6366f1" />
                      </div>
                      <div className="showcase-action-label">Transcribe</div>
                    </div>
                    <div className="showcase-action-item">
                      <div className="showcase-action-icon" style={{ display: "flex", justifyContent: "center" }}>
                        <GlobeIcon size={16} color="#10b981" />
                      </div>
                      <div className="showcase-action-label">Translate</div>
                    </div>
                    <div className="showcase-action-item">
                      <div className="showcase-action-icon" style={{ display: "flex", justifyContent: "center" }}>
                        <VolumeIcon size={16} color="#f59e0b" />
                      </div>
                      <div className="showcase-action-label">TTS Voice</div>
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="showcase-activity">
                    <div className="showcase-activity-title">Recent Activity</div>

                    <div className="showcase-activity-item">
                      <div className="showcase-activity-left">
                        <div className="showcase-activity-dot" style={{ background: "rgba(99,102,241,0.1)" }}>
                          <FileTextIcon size={12} color="#6366f1" />
                        </div>
                        <div>
                          <div className="showcase-activity-name">Podcast Episode</div>
                          <div className="showcase-activity-time">2 min ago</div>
                        </div>
                      </div>
                      <span className="showcase-activity-status status-success">Done</span>
                    </div>

                    <div className="showcase-activity-item">
                      <div className="showcase-activity-left">
                        <div className="showcase-activity-dot" style={{ background: "rgba(245,158,11,0.1)" }}>
                          <GlobeIcon size={12} color="#f59e0b" />
                        </div>
                        <div>
                          <div className="showcase-activity-name">Hindi Translation</div>
                          <div className="showcase-activity-time">5 min ago</div>
                        </div>
                      </div>
                      <span className="showcase-activity-status status-pending">Processing</span>
                    </div>

                    <div className="showcase-activity-item">
                      <div className="showcase-activity-left">
                        <div className="showcase-activity-dot" style={{ background: "rgba(16,185,129,0.1)" }}>
                          <VolumeIcon size={12} color="#10b981" />
                        </div>
                        <div>
                          <div className="showcase-activity-name">Voice Generated</div>
                          <div className="showcase-activity-time">12 min ago</div>
                        </div>
                      </div>
                      <span className="showcase-activity-status status-success">Done</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating decorations */}
              <div className="floating-circle" />
              <div className="floating-square" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
