"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface SidebarProps {
  active: "dashboard" | "record" | "transcribe" | "translate" | "tts" | "pricing";
}

export default function Sidebar({ active }: SidebarProps) {
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserName(localStorage.getItem("userName") || "Valued User");
      setUserEmail(localStorage.getItem("userEmail") || "user@transtts.com");
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userName");
      showToast("Signed out successfully.", "info");
      router.push("/");
    }
  };

  return (
    <aside className="dashboard-sidebar">
      <Link href="/" className="sidebar-logo">
        <div className="logo-icon">🎙️</div>
        TransTTS<span style={{ color: "var(--accent)" }}>AI</span>
      </Link>
      
      <nav className="sidebar-menu">
        <button 
          className={`sidebar-item ${active === "dashboard" ? "active" : ""}`} 
          onClick={() => router.push("/dashboard")}
        >
          📊 Dashboard
        </button>
        <button 
          className={`sidebar-item ${active === "record" ? "active" : ""}`} 
          onClick={() => router.push("/record")}
        >
          🎙️ Voice Recorder
        </button>
        <button 
          className={`sidebar-item ${active === "transcribe" ? "active" : ""}`} 
          onClick={() => router.push("/transcribe")}
        >
          🎤 Transcribe
        </button>
        <button 
          className={`sidebar-item ${active === "translate" ? "active" : ""}`} 
          onClick={() => router.push("/translate")}
        >
          🌐 Translate
        </button>
        <button 
          className={`sidebar-item ${active === "tts" ? "active" : ""}`} 
          onClick={() => router.push("/tts")}
        >
          🔊 Voice Generator
        </button>
        <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
        <button 
          className={`sidebar-item ${active === "pricing" ? "active" : ""}`} 
          onClick={() => router.push("/pricing")}
        >
          💳 Pricing
        </button>

      </nav>
      
      <div className="sidebar-footer">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">👤</div>
          <div className="sidebar-user-details">
            <span className="sidebar-username">{userName}</span>
            <span className="sidebar-email">{userEmail}</span>
          </div>
        </div>
        <button className="sidebar-item" onClick={handleLogout} style={{ color: "var(--error)" }}>
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
