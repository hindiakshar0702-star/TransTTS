"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import Sidebar from "@/components/Sidebar";
import { MicIcon, GlobeIcon, VolumeIcon, FileTextIcon, BarChartIcon, InboxIcon, TrashIcon, CopyIcon, PlayIcon } from "@/components/Icons";
import { getHistory, getStats, deleteFromHistory, clearHistory } from "@/lib/history";

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

  const router = useRouter();
  const { showToast } = useToast();

  // History lives in the browser (no account, no server). Map each stored item
  // onto the shape the rest of this page renders.
  const loadJobs = useCallback(() => {
    const items = getHistory()
      .filter((h) => filter === "all" || h.type === filter)
      .map<Job>((h) => ({
        id: h.id,
        type: h.type,
        title: h.title,
        status: h.status,
        language: h.data.language,
        duration: h.data.duration,
        targetLang: h.data.targetLang,
        voice: h.data.voice,
        transcript: h.data.transcript,
        translatedText: h.data.translatedText,
        audioUrl: h.data.audioUrl,
        createdAt: new Date(h.timestamp).toISOString(),
      }));
    setJobs(items);
    setStats(getStats());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
      loadJobs();
    }
  }, [loadJobs]);

  const handleDelete = (id: string) => {
    deleteFromHistory(id);
    loadJobs();
    showToast("Removed from history", "info");
  };

  const handleClearAll = () => {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    clearHistory();
    loadJobs();
    showToast("History cleared", "success");
  };

  const typeIcon = (type: string) =>
    type === "transcribe" ? <MicIcon size={16} color="#FF8000" /> : type === "translate" ? <GlobeIcon size={16} color="#10b981" /> : type === "tts" ? <VolumeIcon size={16} color="#f59e0b" /> : <FileTextIcon size={16} color="#8b5cf6" />;

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
            <BarChartIcon size={32} color="#FF8000" /> <span className="gradient-text">Personal Dashboard</span>
          </h1>
          <p>Monitor your speech tasks, usage limits, and account history</p>
        </div>

        {/* Top bento row: usage + quick launch. clamp()-based auto-fit → reflows
            to a single column on phones, two cards side by side on wider screens. */}
        <div className="fade-in dashboard-bento-top">

          {/* Bento Card 1: Monthly Usage Limits */}
          <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <BarChartIcon size={18} color="#FF8000" />
                  <span>Monthly Usage Limits</span>
                </h3>
                <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>Free Tier</span>
              </div>
              
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

          {/* Bento Card 2: Quick Launch Tools */}
          <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Quick Launch Tools</h3>
            <div className="quick-launch-tools">
              
              <div className="glass-card" style={{ padding: "18px 14px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass2)", border: "1px solid var(--border)" }} onClick={() => router.push("/transcribe")}>
                <div style={{ marginBottom: "8px" }}><MicIcon size={26} color="#FF8000" /></div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Transcribe</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>Audio/Video to text</div>
              </div>

              <div className="glass-card" style={{ padding: "18px 14px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass2)", border: "1px solid var(--border)" }} onClick={() => router.push("/translate")}>
                <div style={{ marginBottom: "8px" }}><GlobeIcon size={26} color="#10b981" /></div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Translate</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>Multi-lang translation</div>
              </div>

              <div className="glass-card" style={{ padding: "18px 14px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--glass2)", border: "1px solid var(--border)" }} onClick={() => router.push("/tts")}>
                <div style={{ marginBottom: "8px" }}><VolumeIcon size={26} color="#f59e0b" /></div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Voice Gen</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>Text to natural speech</div>
              </div>

            </div>
          </div>

        </div>

        {/* Stats summary cards — clamp() auto-fit, reflows across all devices */}
        <div className="fade-in dashboard-stats">
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

        {/* Filter bar */}
        <div className="filter-bar fade-in" style={{ marginTop: "32px", display: "flex", alignItems: "center", gap: "10px" }}>
          {(["all", "transcribe", "translate", "tts"] as FilterType[]).map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                className={`nav-capsule ${isActive ? "active" : ""}`}
                onClick={() => setFilter(f)}
                style={{
                  cursor: "pointer",
                  border: isActive ? "1.5px solid var(--accent)" : "1px solid rgba(0, 0, 0, 0.08)",
                  background: isActive ? "rgba(255, 128, 0, 0.12)" : "rgba(0, 0, 0, 0.035)",
                  color: isActive ? "var(--accent)" : "var(--text)",
                  fontWeight: isActive ? 700 : 600,
                  boxShadow: isActive ? "0 2px 8px rgba(255, 128, 0, 0.15)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <span className="nav-icon-badge" style={{ background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  {f === "all" ? <FileTextIcon size={14} color="#FF8000" /> : typeIcon(f)}
                </span>
                <span className="nav-label">{f === "all" ? "All" : typeLabel(f)}</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {jobs.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearAll} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <TrashIcon size={14} color="currentColor" />
              <span>Clear All History</span>
            </button>
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
            <div className="empty-icon" style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <InboxIcon size={40} color="#999" />
            </div>
            <h3 style={{ marginBottom: 8 }}>No history yet</h3>
            <p>Start by transcribing audio, translating text, or generating a voice!</p>
            <button className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => router.push("/transcribe")}>
              <MicIcon size={18} color="#0a0a0a" />
              <span>Start Transcribing</span>
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
                    {item.language && <span>{item.language}</span>}
                    {item.duration && <span>{Math.round(item.duration)}s</span>}
                    {item.targetLang && <span>→ {item.targetLang.toUpperCase()}</span>}
                    {item.voice && <span>{item.voice}</span>}
                    <span className={`badge ${item.status === "completed" ? "badge-success" : "badge-error"}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="history-actions" style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(item)} title="Copy Content">
                    <CopyIcon size={14} color="currentColor" />
                  </button>
                  {item.type === "tts" && item.audioUrl && (
                    <button className="btn btn-ghost btn-sm" onClick={() => window.open(item.audioUrl!)} title="Play Audio">
                      <PlayIcon size={14} color="currentColor" />
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} title="Delete Log">
                    <TrashIcon size={14} color="#ef4444" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
