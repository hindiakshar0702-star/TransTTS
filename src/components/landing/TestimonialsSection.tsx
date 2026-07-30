"use client";

import { useEffect, useRef } from "react";
import BentoCard from "./BentoCard";
import { StarIcon, MicIcon, FilmIcon, GlobeIcon } from "./Icons";

const testimonials = [
  {
    stars: 5,
    text: "TransTTS has completely transformed my podcast workflow. I upload episodes and get perfectly timestamped transcripts in minutes. The Hindi translation is incredibly accurate.",
    name: "Priya Sharma",
    role: "Podcast Creator, Mumbai",
    icon: <MicIcon size={18} color="#0a0a0a" />,
    avatarBg: "linear-gradient(135deg, #FF9933, #FF5500)",
  },
  {
    stars: 5,
    text: "As a content creator working in multiple languages, the GPT-powered translation keeps the context perfectly. The TTS voices sound natural and professional.",
    name: "Alex Chen",
    role: "YouTube Creator, Singapore",
    icon: <FilmIcon size={18} color="#5c62ec" />,
    avatarBg: "linear-gradient(135deg, #e8e4ff, #c5d1ff)",
  },
  {
    stars: 5,
    text: "The live recorder with teleprompter is a game-changer. Active noise cancellation works beautifully, and I can generate SRT subtitles with a single click.",
    name: "Sarah Johnson",
    role: "Freelance Translator, London",
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
            ✦ Testimonials
          </div>
          <h2 style={{
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: 900,
            fontFamily: "var(--font-landing-title)",
            letterSpacing: "-0.03em",
          }}>
            Loved by Creators Worldwide
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {testimonials.map((t, i) => (
            <BentoCard key={t.name} className="testimonial-card" delay={i * 0.1}>
              <div className="testimonial-stars" style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                {Array.from({ length: t.stars }).map((_, idx) => (
                  <StarIcon key={idx} size={15} color="#f59e0b" fill="#f59e0b" />
                ))}
              </div>
              <p className="testimonial-text">
                &ldquo;{t.text}&rdquo;
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
