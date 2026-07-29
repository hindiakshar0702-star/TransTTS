"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Sidebar from "@/components/Sidebar";

interface Job {
  id: string;
  type: string;
  title: string;
  status: string;
  language?: string;
  duration?: number;
  targetLang?: string;
  voice?: string;
  transcript?: string;
  translatedText?: string;
  audioUrl?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  transcriptions: number;
  translations: number;
  ttsGenerations: number;
  totalMinutes: number;
}

type FilterType = "all" | "transcribe" | "translate" | "tts";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [stats, setStats] = useState<Stats>({ total: 0, transcriptions: 0, translations: 0, ttsGenerations: 0, totalMinutes: 0 });
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const router = useRouter();
  const { showToast } = useToast();

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userName");
      showToast("Signed out successfully.", "info");
      router.push("/");
    }
  };

  // Authentication Guard on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      if (!loggedIn) {
        showToast("Please sign in to access your dashboard.", "error");
        router.push("/login?redirect=/dashboard");
      } else {
        setIsAuth(true);
        setUserEmail(localStorage.getItem("userEmail") || "user@transtts.com");
        setUserName(localStorage.getItem("userName") || "Valued User");
        fetchJobs();
      }
    }
  }, [router, filter]);

  const fetchJobs = async () => {
    try {
      const typeParam = filter === "all" ? "" : `?type=${filter}`;
      const res = await fetch(`/api/jobs${typeParam}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const text = await res.text();
      const data = JSON.parse(text);
      setJobs(data.jobs || []);
      setStats(data.stats || { total: 0, transcriptions: 0, translations: 0, ttsGenerations: 0, totalMinutes: 0 });
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      fetchJobs();
      showToast("Job deleted", "info");
    } catch { showToast("Delete failed", "error"); }
  };

  const handleClearAll = async () => {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    try {
      await fetch("/api/jobs", { method: "DELETE" });
      fetchJobs();
      showToast("History cleared", "success");
    } catch { showToast("Clear failed", "error"); }
  };

  const typeIcon = (type: string) =>
    type === "transcribe" ? "🎤" : type === "translate" ? "🌐" : type === "tts" ? "🔊" : "📄";

  const typeLabel = (type: string) =>
    type === "transcribe" ? "Transcription" : type === "translate" ? "Translation" : "Voice Generation";

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleCopy = (item: Job) => {
    const text = item.type === "transcribe" ? item.transcript : item.type === "translate" ? item.translatedText : item.title;
    if (text) {
      navigator.clipboard.writeText(text);
      showToast("Copied to clipboard!", "success");
    }
  };

  if (!isAuth) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar active="dashboard" />

      {/* Main Content Area */}
      <div className="dashboard-content-wrapper">
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "32px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.4rem", display: "flex", alignItems: "center", gap: "12px" }}>
            📊 <span className="gradient-text">Personal Dashboard</span>
          </h1>
          <p>Monitor your speech tasks, usage limits, and account history</p>
        </div>

        {/* Dashboard Bento Grid */}
        <div className="teleprompter-grid fade-in" style={{ gridTemplateColumns: "0.8fr 1.2fr", gap: "24px", marginBottom: "28px", height: "auto" }}>
          
          {/* LEFT COLUMN: Profile & Quotas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Profile card */}
            <div className="glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                  👤
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    {userName} 
                    <span className="badge badge-success" style={{ padding: "2px 8px", fontSize: "0.68rem" }}>✔️ Verified</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{userEmail}</div>
                </div>
              </div>
              
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>Account Plan:</span>
                <span className="badge badge-info" style={{ fontWeight: 700 }}>Free Tier</span>
              </div>
            </div>

            {/* Usage Quota Card */}
            <div className="glass-card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>📊 Monthly Usage Limits</h3>
              
              {/* Transcribe Quota */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "6px" }}>
                  <span>Transcription Time</span>
                  <span style={{ fontWeight: 600 }}>{Math.round(stats.totalMinutes)} / 60 mins</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (stats.totalMinutes / 60) * 100)}%` }} />
                </div>
              </div>

              {/* Translate Quota */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "6px" }}>
                  <span>Translations (Jobs)</span>
                  <span style={{ fontWeight: 600 }}>{stats.translations} / 50 jobs</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (stats.translations / 50) * 100)}%`, background: "var(--gradient2)" }} />
                </div>
              </div>

              {/* TTS Quota */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "6px" }}>
                  <span>Voice Generations</span>
                  <span style={{ fontWeight: 600 }}>{stats.ttsGenerations} / 100 clips</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (stats.ttsGenerations / 100) * 100)}%`, background: "linear-gradient(135deg, #10b981, #06b6d4)" }} />
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: Quick Actions & Stats summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Quick Actions bento grid */}
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px" }}>🚀 Quick Launch Tools</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                
                <div className="glass-card" style={{ padding: "20px", cursor: "pointer", textAlign: "center" }} onClick={() => router.push("/transcribe")}>
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎤</div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Transcribe</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>Audio/Video to text</div>
                </div>

                <div className="glass-card" style={{ padding: "20px", cursor: "pointer", textAlign: "center" }} onClick={() => router.push("/translate")}>
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🌐</div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Translate</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>Multi-lang translation</div>
                </div>

                <div className="glass-card" style={{ padding: "20px", cursor: "pointer", textAlign: "center" }} onClick={() => router.push("/tts")}>
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔊</div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Voice Gen</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>Text to natural speech</div>
                </div>

              </div>
            </div>

            {/* Stats Counters */}
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-title">Total Jobs</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.transcriptions}</div>
                <div className="stat-title">Transcriptions</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.translations}</div>
                <div className="stat-title">Translations</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.ttsGenerations}</div>
                <div className="stat-title">Voice Generated</div>
              </div>
            </div>

          </div>

        </div>

        {/* Filter bar */}
        <div className="filter-bar fade-in" style={{ marginTop: "32px" }}>
          {(["all", "transcribe", "translate", "tts"] as FilterType[]).map((f) => (
            <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "📋 All" : `${typeIcon(f)} ${typeLabel(f)}`}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {jobs.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>🗑️ Clear All History</button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="empty-state fade-in">
            <span className="spinner" style={{ width: 32, height: 32 }}></span>
            <p style={{ marginTop: 16 }}>Loading activity data...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state fade-in">
            <div className="empty-icon">📭</div>
            <h3 style={{ marginBottom: 8 }}>No history yet</h3>
            <p>Start by transcribing audio, translating text, or generating a voice!</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => router.push("/transcribe")}>
              🎤 Start Transcribing
            </button>
          </div>
        ) : (
          <div className="history-list fade-in">
            {jobs.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-icon">{typeIcon(item.type)}</div>
                <div className="history-info">
                  <div className="history-title">{item.title}</div>
                  <div className="history-meta">
                    <span>{typeLabel(item.type)}</span>
                    <span>{timeAgo(item.createdAt)}</span>
                    {item.language && <span>🌐 {item.language}</span>}
                    {item.duration && <span>⏱️ {Math.round(item.duration)}s</span>}
                    {item.targetLang && <span>→ {item.targetLang.toUpperCase()}</span>}
                    {item.voice && <span>🎧 {item.voice}</span>}
                    <span className={`badge ${item.status === "completed" ? "badge-success" : "badge-error"}`}>
                      {item.status === "completed" ? "✅" : "❌"} {item.status}
                    </span>
                  </div>
                </div>
                <div className="history-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(item)} title="Copy Content">📋</button>
                  {item.type === "tts" && item.audioUrl && (
                    <button className="btn btn-ghost btn-sm" onClick={() => window.open(item.audioUrl!)} title="Play Audio">▶</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} title="Delete Log">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
