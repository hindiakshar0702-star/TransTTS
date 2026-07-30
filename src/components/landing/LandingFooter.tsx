"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function LandingFooter() {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transition = "opacity 0.5s ease";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <footer ref={footerRef} className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-inner">
          {/* Left: Logo + Copyright */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="/" className="landing-logo">
              <img src="/logo.svg" alt="TransTTS" style={{ height: 26, width: "auto" }} />
            </Link>
            <span className="landing-footer-copy">© 2026 TransTTS AI. All rights reserved.</span>
          </div>

          {/* Right: Links */}
          <div className="landing-footer-links">
            <Link href="/transcribe">Transcribe</Link>
            <Link href="/translate">Translate</Link>
            <Link href="/tts">Voice Generator</Link>
            <Link href="/record">Recorder</Link>
            <Link href="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
