"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ToolNav from "@/components/ToolNav";
import { useToast } from "@/components/Toast";

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
  const router = useRouter();
  const { showToast } = useToast();

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

  useEffect(() => { fetchJobs(); }, [filter]);

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

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container">
          <div className="app-header fade-in">
            <h1>📊 <span className="gradient-text">Dashboard</span></h1>
            <p>Your transcription, translation &amp; voice generation history</p>
          </div>

          <ToolNav />

          {/* Stats */}
          <div className="stats-grid fade-in">
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
          <div className="filter-bar fade-in">
            {(["all", "transcribe", "translate", "tts"] as FilterType[]).map((f) => (
              <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "📋 All" : `${typeIcon(f)} ${typeLabel(f)}`}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {jobs.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleClearAll}>🗑️ Clear All</button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="empty-state fade-in">
              <span className="spinner" style={{ width: 32, height: 32 }}></span>
              <p style={{ marginTop: 16 }}>Loading...</p>
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
                    <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(item)} title="Copy">📋</button>
                    {item.type === "tts" && item.audioUrl && (
                      <button className="btn btn-ghost btn-sm" onClick={() => window.open(item.audioUrl!)} title="Play">▶</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} title="Delete">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
