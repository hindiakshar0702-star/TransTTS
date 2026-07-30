"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MicIcon, GlobeIcon, VolumeIcon, PlayIcon, ArrowRightIcon, FileTextIcon } from "./Icons";

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
                Transcribe, translate
                <br />
                &amp; voice
                <br />
                in seconds
              </h1>

              <p className="hero-desc">
                Turn any audio into accurate text, translate across 25+ languages,
                and generate natural speech — all in one fast, private workspace.
              </p>

              <div className="hero-actions">
                <Link href="/transcribe" className="hero-btn-primary">
                  <span>Start Free</span>
                  <ArrowRightIcon size={16} color="#0a0a0a" />
                </Link>
                <Link href="/login" className="hero-btn-secondary">
                  <PlayIcon size={12} color="#1a1a1a" />
                  <span>See How It Works</span>
                </Link>
              </div>
            </div>

            {/* Bottom Bento Sub-Grid matching Image 1: 15 Million+ on Left, Stacked User Cards on Right */}
            <div className="hero-bento-subgrid">
              {/* Left: 15 Million+ Bento Card */}
              <div className="stat-bento-card">
                <div className="stat-bento-header">
                  <h3 className="stat-bento-title">15 Million+</h3>
                  <div className="live-status-badge">
                    <span className="live-dot" />
                    <span className="live-text">Live</span>
                  </div>
                </div>
                <p className="stat-bento-desc">
                  words transcribed<br />with our AI engine
                </p>
              </div>

              {/* Right: Stacked User Cards with Vector Lucide Icon Circles */}
              <div className="user-cards-stack">
                <div className="bento-user-card">
                  <div className="user-card-avatar-circle">
                    <MicIcon size={18} color="#5c62ec" />
                  </div>
                  <div className="user-card-details">
                    <h4 className="user-card-name">Priya Sharma</h4>
                    <p className="user-card-role">Content creator using TransTTS daily</p>
                  </div>
                </div>
                <div className="bento-user-card">
                  <div className="user-card-avatar-circle">
                    <GlobeIcon size={18} color="#5c62ec" />
                  </div>
                  <div className="user-card-details">
                    <h4 className="user-card-name">Alex Chen</h4>
                    <p className="user-card-role">Translator & podcaster</p>
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
                    <div style={{ fontSize: "0.6rem", color: "#999" }}>● Online</div>
                  </div>

                  {/* Main stat */}
                  <div className="showcase-balance">
                    <div className="showcase-balance-label">Words Processed</div>
                    <div className="showcase-balance-value">15,482,930</div>
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
