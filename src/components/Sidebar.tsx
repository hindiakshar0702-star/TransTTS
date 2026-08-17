"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon, RadioIcon, MicIcon, GlobeIcon, VolumeIcon, SettingsIcon, MenuIcon, XIcon } from "@/components/Icons";
import Logo from "@/components/Logo";

interface SidebarProps {
  active: "dashboard" | "record" | "transcribe" | "translate" | "tts" | "profile" | "settings";
}

export default function Sidebar({ active }: SidebarProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigate and always close the mobile drawer.
  const go = (href: string) => {
    router.push(href);
    setDrawerOpen(false);
  };

  const navItems = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", short: "Home", icon: HomeIcon },
    { id: "record", href: "/record", label: "Voice Recorder", short: "Record", icon: RadioIcon },
    { id: "transcribe", href: "/transcribe", label: "Transcribe", short: "Text", icon: MicIcon },
    { id: "translate", href: "/translate", label: "Translate", short: "Translate", icon: GlobeIcon },
    { id: "tts", href: "/tts", label: "Voice Generator", short: "Voice", icon: VolumeIcon },
    { id: "settings", href: "/settings", label: "Settings", short: "Settings", icon: SettingsIcon },
  ];
  // Bottom tab bar shows the 5 primary tools; Settings lives in the drawer.
  const bottomTabItems = navItems.filter((i) => i.id !== "settings");

  return (
    <>
      {/* Mobile top bar — hamburger opens the drawer (mobile only, hidden on desktop) */}
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
        >
          <MenuIcon size={22} color="currentColor" />
        </button>
        <Logo height={24} variant="dark" href="/" />
      </div>

      {/* Drawer backdrop (mobile only, only when open) */}
      {drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside className={`dashboard-sidebar ${drawerOpen ? "open" : ""}`}>
      {/* Brand Header + mobile drawer close */}
      <div className="sidebar-brand-row" style={{ padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo height={32} variant="dark" href="/" />
        <button
          type="button"
          className="sidebar-drawer-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        >
          <XIcon size={20} color="currentColor" />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-menu">
        <div className="sidebar-menu-label">Main Navigation</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => go(item.href)}
            >
              <span className="sidebar-item-icon">
                <Icon size={18} color="currentColor" />
              </span>
              <span className="sidebar-item-label">{item.label}</span>
              {isActive && <span className="sidebar-active-indicator" />}
            </button>
          );
        })}
      </nav>

      {/* User Profile & Sign Out Footer */}
      <div className="sidebar-footer">
        {/* User profile card hidden for now — /profile page stays; re-add this block to restore.
        <div
          className={`sidebar-profile-card ${active === "profile" ? "active" : ""}`}
          onClick={() => router.push("/profile")}
          style={{ cursor: "pointer", transition: "all 0.2s ease" }}
          title="Click to view User Profile & Settings"
        >
          <div className="sidebar-avatar-wrapper">
            <div
              className="sidebar-avatar"
              style={{ overflow: "hidden", background: userAvatar ? "transparent" : "linear-gradient(135deg, #ff8000 0%, #ff5500 100%)" }}
            >
              {userAvatar ? (
                <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#ffffff", fontWeight: 800, fontSize: "0.95rem" }}>
                  {userName ? userName.substring(0, 1).toUpperCase() : <UserIcon size={18} color="#ffffff" />}
                </span>
              )}
            </div>
            <span className="sidebar-status-dot" title="Online" />
          </div>
          <div className="sidebar-user-details">
            <span className="sidebar-username">{userName}</span>
            <span className="sidebar-email">{userEmail}</span>
          </div>
        </div>
        */}

        <button className="sidebar-home-btn" onClick={() => go("/")}>
          <HomeIcon size={16} color="currentColor" />
          <span>Back to Home</span>
        </button>
      </div>
    </aside>

      {/* Bottom tab bar — app-like primary nav (mobile only, hidden on desktop) */}
      <nav className="bottom-tab-bar">
        {bottomTabItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-tab ${isActive ? "active" : ""}`}
              onClick={() => router.push(item.href)}
              aria-label={item.label}
            >
              <Icon size={20} color="currentColor" />
              <span>{item.short}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
