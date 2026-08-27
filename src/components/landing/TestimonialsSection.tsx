"use client";

import { useEffect, useRef } from "react";
import BentoCard from "./BentoCard";
import { MicIcon, FilmIcon, GlobeIcon } from "./Icons";

// Use cases, not testimonials. The site is new and has no real reviews, so it
// describes what the tool does for whom rather than inventing people and
// quotes. Every capability named here is one the app actually has.
const useCases = [
  {
    text: "Upload an episode and get a timestamped transcript, then translate it into Hindi or export SRT subtitles — without leaving the browser.",
    name: "For podcasters",
    role: "Transcribe & subtitle",
    icon: <MicIcon size={18} color="#0a0a0a" />,
    avatarBg: "linear-gradient(135deg, #FF9933, #FF5500)",
  },
  {
    text: "Turn a script into a natural AI voiceover in Hindi, English or another language, and reuse the same text across your videos and reels.",
    name: "For creators",
    role: "AI voice generation",
    icon: <FilmIcon size={18} color="#5c62ec" />,
    avatarBg: "linear-gradient(135deg, #e8e4ff, #c5d1ff)",
  },
  {
    text: "Convert lecture notes to speech to listen on the go, or translate study material across 25+ languages and hear it read aloud.",
    name: "For students",
    role: "Listen & translate",
    icon: <GlobeIcon size={18} color="#b45309" />,
    avatarBg: "linear-gradient(135deg, #fde68a, #fbbf24)",
  },
];

export default function TestimonialsSection() {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = "opacity 0.5s ease, transform 0.5s ease";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section style={{ padding: "24px 0" }} id="testimonials">
      <div className="landing-container">
        <div ref={headerRef} style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.1em", color: "var(--color-landing-text-dim)", marginBottom: 12
          }}>
            ✦ Use cases
          </div>
          <h2 style={{
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: 900,
            fontFamily: "var(--font-landing-title)",
            letterSpacing: "-0.03em",
          }}>
            Made for real work
          </h2>
        </div>

        <div className="testimonials-track" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {useCases.map((t, i) => (
            <BentoCard key={t.name} className="testimonial-card" delay={i * 0.1}>
              <p className="testimonial-text">
                {t.text}
              </p>
              <div className="testimonial-author">
                <div className="testimonial-avatar" style={{ background: t.avatarBg }}>
                  {t.icon}
                </div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </BentoCard>
          ))}
        </div>
      </div>
    </section>
  );
}
