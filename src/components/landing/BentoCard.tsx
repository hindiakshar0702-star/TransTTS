"use client";

import { useRef, useEffect, type ReactNode, type MouseEvent } from "react";

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "dark" | "accent";
  span?: number;
  delay?: number;
}

export default function BentoCard({
  children,
  className = "",
  variant = "default",
  span,
  delay = 0,
}: BentoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Scroll reveal via IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = `opacity 0.6s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.6s ${delay}s cubic-bezier(0.16,1,0.3,1)`;

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
  }, [delay]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!glowRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    glowRef.current.style.left = `${e.clientX - rect.left}px`;
    glowRef.current.style.top = `${e.clientY - rect.top}px`;
  };

  const variantClass =
    variant === "dark" ? "bento-card-dark"
    : variant === "accent" ? "bento-card-accent"
    : "";

  return (
    <div
      ref={cardRef}
      className={`bento-card ${variantClass} ${className}`}
      style={span ? { gridColumn: `span ${span}` } : undefined}
      onMouseMove={handleMouseMove}
    >
      <div ref={glowRef} className="glow-effect" />
      {children}
    </div>
  );
}
