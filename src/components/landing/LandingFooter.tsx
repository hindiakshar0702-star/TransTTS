"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { InstagramIcon, TwitterXIcon, LinkedinIcon, YoutubeIcon, GithubIcon } from "@/components/Icons";

// Placeholder handles — swap for real TransTTS accounts when available.
const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/transtts", Icon: InstagramIcon },
  { label: "X (Twitter)", href: "https://x.com/transtts", Icon: TwitterXIcon },
  { label: "LinkedIn", href: "https://linkedin.com/company/transtts", Icon: LinkedinIcon },
  { label: "YouTube", href: "https://youtube.com/@transtts", Icon: YoutubeIcon },
  { label: "GitHub", href: "https://github.com/transtts", Icon: GithubIcon },
];

const PRODUCT_LINKS = [
  { label: "Recorder", href: "/record" },
  { label: "Transcribe", href: "/transcribe" },
  { label: "Translate", href: "/translate" },
  { label: "Voice Generator", href: "/tts" },
];

const COMPANY_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];

export default function LandingFooter() {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transition = "opacity 0.6s ease";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          observer.unobserve(el);
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <footer ref={footerRef} className="site-footer">
      <div className="landing-container">
        <div className="site-footer-grid">
          {/* Brand column */}
          <div className="site-footer-brand">
            <Logo height={30} variant="dark" href="/" />
            <p className="site-footer-tagline">
              Record, transcribe, translate, and generate lifelike speech — all in one place.
            </p>
            <div className="site-footer-socials" aria-label="Social media">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="site-footer-social"
                >
                  <Icon size={18} color="currentColor" />
                </a>
              ))}
            </div>
          </div>

          {/* Product column */}
          <nav className="site-footer-col" aria-label="Product">
            <h3 className="site-footer-heading">Product</h3>
            {PRODUCT_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="site-footer-link">{l.label}</Link>
            ))}
          </nav>

          {/* Company / Quick Links column */}
          <nav className="site-footer-col" aria-label="Company">
            <h3 className="site-footer-heading">Company</h3>
            {COMPANY_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="site-footer-link">{l.label}</Link>
            ))}
          </nav>

          {/* Legal column */}
          <nav className="site-footer-col" aria-label="Legal">
            <h3 className="site-footer-heading">Legal</h3>
            {LEGAL_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="site-footer-link">{l.label}</Link>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="site-footer-bottom">
          <span className="site-footer-copy">© 2026 TransTTS. All rights reserved.</span>
          <div className="site-footer-bottom-links">
            <Link href="/privacy-policy" className="site-footer-link">Privacy</Link>
            <Link href="/terms-and-conditions" className="site-footer-link">Terms</Link>
            <Link href="/contact" className="site-footer-link">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
