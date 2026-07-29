"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  
  const isApp = pathname !== "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLoggedIn(localStorage.getItem("isLoggedIn") === "true");
    }
  }, [pathname]);

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userName");
      setIsLoggedIn(false);
      showToast("Signed out successfully.", "info");
      router.push("/");
    }
  };

  const appLinks = [
    { href: "/record", icon: "🎙️", label: "Voice Recorder" },
    { href: "/transcribe", icon: "🎤", label: "Transcribe" },
    { href: "/translate", icon: "🌐", label: "Translate" },
    { href: "/tts", icon: "🔊", label: "Voice Generator" },
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
              <li><Link href="/pricing">Free Plan</Link></li>
            </>
          )}
        </ul>

        <div className="nav-actions" style={{ gap: "12px" }}>
          {isLoggedIn ? (
            <>
              <button onClick={handleSignOut} className="btn btn-danger btn-sm">Sign Out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/transcribe" className="btn btn-primary btn-sm">🚀 Start Free</Link>
            </>
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
