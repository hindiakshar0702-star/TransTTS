"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RadioIcon, MicIcon, GlobeIcon, VolumeIcon, SunIcon, MoonIcon, MenuIcon, XIcon } from "./Icons";
import Logo from "@/components/Logo";

export default function LandingNavbar() {
  const navRef = useRef<HTMLElement>(null);
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sync toggle state with the theme the layout pre-paint script already applied.
  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  // Toggle light/dark, persist to the same key the Settings page + layout use.
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      sessionStorage.setItem("transtts_settings_theme", JSON.stringify(next));
    } catch { /* ignore */ }
    setIsDark(!isDark);
  };

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
    <nav className="landing-nav landing-nav--split" ref={navRef}>
      <div className="landing-nav-inner">
        {/* Group 1: Logo */}
        <div className="landing-nav-group landing-nav-logo-group">
          <Logo height={28} variant="light" href="/" />
        </div>

        {/* Group 2: Navigation items */}
        <ul className="landing-nav-group landing-nav-links">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="nav-item">
                <span className="nav-icon-badge">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Group 3: Theme toggle + (mobile) hamburger */}
        <div className="landing-nav-group landing-nav-theme">
          <button
            type="button"
            className="nav-theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="nav-icon-badge">
              {isDark ? <SunIcon size={15} color="#1a1a1a" /> : <MoonIcon size={15} color="#1a1a1a" />}
            </span>
          </button>
          <button
            type="button"
            className="nav-hamburger-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className="nav-icon-badge">
              {menuOpen ? <XIcon size={15} color="#1a1a1a" /> : <MenuIcon size={15} color="#1a1a1a" />}
            </span>
          </button>
        </div>

        {/* Mobile dropdown menu (shown only on small screens when open) */}
        {menuOpen && (
          <ul className="landing-nav-mobile-menu">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="nav-item" onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon-badge">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
