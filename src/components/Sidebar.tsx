"use client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useSession, logout } from "@/lib/useSession";
import { HomeIcon, RadioIcon, MicIcon, GlobeIcon, VolumeIcon, UserIcon, LogOutIcon, SettingsIcon } from "@/components/Icons";
import Logo from "@/components/Logo";

interface SidebarProps {
  active: "dashboard" | "record" | "transcribe" | "translate" | "tts" | "profile" | "settings";
}

export default function Sidebar({ active }: SidebarProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const { user } = useSession();
  const userName = user?.name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";
  const userAvatar = user?.image || "";

  const handleLogout = async () => {
    await logout();
    showToast("Signed out successfully.", "info");
    router.push("/");
    router.refresh();
  };

  const navItems = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: HomeIcon },
    { id: "record", href: "/record", label: "Voice Recorder", icon: RadioIcon },
    { id: "transcribe", href: "/transcribe", label: "Transcribe", icon: MicIcon },
    { id: "translate", href: "/translate", label: "Translate", icon: GlobeIcon },
    { id: "tts", href: "/tts", label: "Voice Generator", icon: VolumeIcon },
    { id: "settings", href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <aside className="dashboard-sidebar">
      {/* Brand Header */}
      <div style={{ padding: "4px 8px" }}>
        <Logo height={32} variant="dark" href="/" />
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
              onClick={() => router.push(item.href)}
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


        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <LogOutIcon size={16} color="currentColor" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
