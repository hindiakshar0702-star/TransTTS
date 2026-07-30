"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useSession, logout } from "@/lib/useSession";
import { RadioIcon, MicIcon, GlobeIcon, VolumeIcon, ArrowUpRightIcon } from "@/components/landing/Icons";

import Logo from "@/components/Logo";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();

  const { user } = useSession();
  const isLoggedIn = !!user;

  const handleSignOut = async () => {
    await logout();
    showToast("Signed out successfully.", "info");
    router.push("/");
    router.refresh();
  };

  const navItems = [
    { label: "Recorder", href: "/record", icon: <RadioIcon size={14} color="#1a1a1a" /> },
    { label: "Transcribe", href: "/transcribe", icon: <MicIcon size={14} color="#1a1a1a" /> },
    { label: "Translate", href: "/translate", icon: <GlobeIcon size={14} color="#1a1a1a" /> },
    { label: "Voice Generator", href: "/tts", icon: <VolumeIcon size={14} color="#1a1a1a" /> },
  ];

  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        {/* Logo */}
        <Logo height={28} variant="light" href="/" />

        {/* Navigation Links with Glossy Pill & Vector Lucide Icon Badges */}
        <ul className="landing-nav-links">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className={`nav-capsule ${pathname === item.href ? "active" : ""}`}>
                <span className="nav-icon-badge">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Action Group: Sign Out or Saffron CTA Pill */}
        <div>
          {isLoggedIn ? (
            <button onClick={handleSignOut} className="btn btn-danger btn-sm">
              Sign Out
            </button>
          ) : (
            <div className="landing-nav-cta-group">
              <Link href="/transcribe" className="landing-nav-cta">
                Start Free
              </Link>
              <Link href="/transcribe" className="landing-nav-arrow-btn" aria-label="Open TransTTS">
                <ArrowUpRightIcon size={18} color="#ffffff" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
