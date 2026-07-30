"use client";

import { useEffect, useRef } from "react";
import AnimatedCounter from "./AnimatedCounter";

const stats = [
  { target: 99, suffix: "+", label: "Languages" },
  { target: 95, suffix: "%", label: "Accuracy" },
  { target: 6, suffix: "", label: "AI Voices" },
  { target: 0, suffix: "", label: "To Start", prefix: "Free " },
];

export default function StatsSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "-60px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section style={{ padding: "24px 0" }} id="stats">
      <div className="landing-container">
        <div ref={gridRef} className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="bento-card stat-card">
              {stat.prefix ? (
                <div className="stat-number">{stat.prefix}</div>
              ) : (
                <AnimatedCounter
                  target={stat.target}
                  suffix={stat.suffix}
                  duration={1800}
                />
              )}
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
