"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isApp = pathname !== "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const appLinks = [
    { href: "/transcribe", icon: "🎤", label: "Transcribe" },
    { href: "/translate", icon: "🌐", label: "Translate" },
    { href: "/tts", icon: "🔊", label: "Voice Generator" },
    { href: "/dashboard", icon: "📊", label: "Dashboard" },
  ];

  // ESC closes the mobile menu — and returns focus to the hamburger
  // so keyboard users don't lose their place.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <nav className="navbar" aria-label="Main">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <div className="logo-icon" aria-hidden="true">🎙️</div>
          TransTTS<span style={{ color: "var(--accent)" }}>AI</span>
        </Link>

        {/* Desktop nav */}
        <ul className="nav-links">
          {isApp ? (
            appLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`nav-link ${pathname === l.href ? "active" : ""}`}
                  aria-current={pathname === l.href ? "page" : undefined}
                >
                  <span aria-hidden="true">{l.icon}</span> {l.label}
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
            <button
              ref={hamburgerRef}
              type="button"
              className="hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
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
          <div
            className="mobile-overlay"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-menu"
            className="mobile-menu"
            role="menu"
            aria-label="Mobile navigation"
          >
            {appLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`mobile-menu-item ${pathname === l.href ? "active" : ""}`}
                role="menuitem"
                aria-current={pathname === l.href ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span style={{ fontSize: "1.3rem" }} aria-hidden="true">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <div
              style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }}
              role="separator"
            />
            <Link
              href="/"
              className="mobile-menu-item"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              ← Home
            </Link>
          </div>
        </>
      )}
    </nav>
  );
}
