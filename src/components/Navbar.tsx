"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isApp = pathname !== "/";
  const [menuOpen, setMenuOpen] = useState(false);

  const appLinks = [
    { href: "/transcribe", icon: "🎤", label: "Transcribe" },
    { href: "/translate", icon: "🌐", label: "Translate" },
    { href: "/tts", icon: "🔊", label: "Voice Generator" },
    { href: "/dashboard", icon: "📊", label: "Dashboard" },
  ];

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <div className="logo-icon">🎙️</div>
          TransTTS<span style={{ color: "var(--accent)" }}>AI</span>
        </Link>

        {/* Desktop nav */}
        <ul className="nav-links">
          {isApp ? (
            appLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`nav-link ${pathname === l.href ? "active" : ""}`}>
                  {l.icon} {l.label}
                </Link>
              </li>
            ))
          ) : (
            <>
              <li><a href="#features">Features</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
              <li><Link href="/pricing">Pricing</Link></li>
            </>
          )}
        </ul>

        <div className="nav-actions">
          {isApp ? (
            <Link href="/" className="btn btn-ghost">← Home</Link>
          ) : (
            <Link href="/transcribe" className="btn btn-primary">🚀 Start Free</Link>
          )}

          {/* Hamburger button (mobile only) */}
          {isApp && (
            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
              <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
              <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
          <div className="mobile-menu">
            {appLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`mobile-menu-item ${pathname === l.href ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                <span style={{ fontSize: "1.3rem" }}>{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
            <Link href="/" className="mobile-menu-item" onClick={() => setMenuOpen(false)}>
              ← Home
            </Link>
          </div>
        </>
      )}
    </nav>
  );
}
