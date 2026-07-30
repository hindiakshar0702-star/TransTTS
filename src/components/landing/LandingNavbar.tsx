"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { RadioIcon, MicIcon, GlobeIcon, VolumeIcon, ArrowUpRightIcon } from "./Icons";
import Logo from "@/components/Logo";

export default function LandingNavbar() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    el.style.transform = "translateY(-64px)";
    el.style.opacity = "0";
    el.style.transition = "transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease";
    requestAnimationFrame(() => {
      el.style.transform = "translateY(0)";
      el.style.opacity = "1";
    });
  }, []);

  const navItems = [
    { label: "Recorder", href: "/record", icon: <RadioIcon size={14} color="#1a1a1a" /> },
    { label: "Transcribe", href: "/transcribe", icon: <MicIcon size={14} color="#1a1a1a" /> },
    { label: "Translate", href: "/translate", icon: <GlobeIcon size={14} color="#1a1a1a" /> },
    { label: "Voice Generator", href: "/tts", icon: <VolumeIcon size={14} color="#1a1a1a" /> },
  ];

  return (
    <nav className="landing-nav" ref={navRef}>
      <div className="landing-nav-inner">
        {/* Logo */}
        <Logo height={28} variant="light" href="/" />

        {/* Navigation Links with Glossy Pill & Vector Lucide Icon Badges */}
        <ul className="landing-nav-links">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="nav-capsule">
                <span className="nav-icon-badge">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Action Group: Saffron CTA Pill + Black Arrow Circle */}
        <div className="landing-nav-cta-group">
          <Link href="/transcribe" className="landing-nav-cta">
            Start Free
          </Link>
          <Link href="/transcribe" className="landing-nav-arrow-btn" aria-label="Open TransTTS">
            <ArrowUpRightIcon size={18} color="#ffffff" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
