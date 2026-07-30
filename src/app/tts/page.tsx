"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { CountrySvgFlag } from "@/components/LanguageSelect";
import { useToast } from "@/components/Toast";

import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import Waveform from "@/components/Waveform";
import {
  VolumeIcon, RefreshIcon, FileTextIcon,
  HeadphonesIcon, SettingsIcon, MusicIcon, PlayIcon,
  PauseIcon, DownloadIcon, AlertCircleIcon, SearchIcon, CheckCircleIcon
} from "@/components/Icons";

const VOICES = [
  { id: "hi-female", name: "Swara", flag: "in", desc: "Hindi Female", lang: "Hindi", avatar: "/avatar/avatar-1.svg" },
  { id: "hi-male", name: "Madhur", flag: "in", desc: "Hindi Male", lang: "Hindi", avatar: "/avatar/avatar-2.svg" },
  { id: "en-female", name: "Jenny", flag: "us", desc: "English Female", lang: "English", avatar: "/avatar/avatar-4.svg" },
  { id: "en-male", name: "Guy", flag: "us", desc: "English Male", lang: "English", avatar: "/avatar/avatar-2.svg" },
  { id: "en-uk-female", name: "Sonia", flag: "gb", desc: "British Female", lang: "English", avatar: "/avatar/avatar-1.svg" },
  { id: "en-uk-male", name: "Ryan", flag: "gb", desc: "British Male", lang: "English", avatar: "/avatar/avatar-2.svg" },
  { id: "es-female", name: "Elvira", flag: "es", desc: "Spanish Female", lang: "Spanish", avatar: "/avatar/avatar-4.svg" },
  { id: "fr-female", name: "Denise", flag: "fr", desc: "French Female", lang: "French", avatar: "/avatar/avatar-1.svg" },
  { id: "de-female", name: "Katja", flag: "de", desc: "German Female", lang: "German", avatar: "/avatar/avatar-4.svg" },
  { id: "ja-female", name: "Nanami", flag: "jp", desc: "Japanese Female", lang: "Japanese", avatar: "/avatar/avatar-1.svg" },
  { id: "bn-female", name: "Tanishaa", flag: "in", desc: "Bengali Female", lang: "Bengali", avatar: "/avatar/avatar-4.svg" },
  { id: "ta-female", name: "Pallavi", flag: "in", desc: "Tamil Female", lang: "Tamil", avatar: "/avatar/avatar-1.svg" },
  { id: "te-female", name: "Shruti", flag: "in", desc: "Telugu Female", lang: "Telugu", avatar: "/avatar/avatar-4.svg" },
  { id: "mr-female", name: "Aarohi", flag: "in", desc: "Marathi Female", lang: "Marathi", avatar: "/avatar/avatar-1.svg" },
  { id: "gu-female", name: "Dhwani", flag: "in", desc: "Gujarati Female", lang: "Gujarati", avatar: "/avatar/avatar-4.svg" },
  { id: "ur-male", name: "Asad", flag: "pk", desc: "Urdu Male", lang: "Urdu", avatar: "/avatar/avatar-2.svg" },
  { id: "ar-male", name: "Hamed", flag: "sa", desc: "Arabic Male", lang: "Arabic", avatar: "/avatar/avatar-2.svg" },
  { id: "pt-female", name: "Francisca", flag: "br", desc: "Portuguese Female", lang: "Portuguese", avatar: "/avatar/avatar-1.svg" },
];

export default function TTSPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <TTSContent />
    </Suspense>
  );
}

function TTSContent() {
  const [isAuth, setIsAuth] = useState(false);
  const searchParams = useSearchParams();
  const [text, setText] = usePersistedState("tts_text", "");
  const [voice, setVoice] = usePersistedState("tts_voice", "hi-female");
  const [speed, setSpeed] = usePersistedState("tts_speed", 1.0);
  const [status, setStatus] = usePersistedState<"idle" | "generating" | "done" | "error">("tts_status", "idle");
  const [audioUrl, setAudioUrl] = usePersistedState("tts_audioUrl", "");
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const audioRef = useRef<HTMLAudioElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    const t = searchParams.get("text");
    if (t) { setText(t); setStatus("idle"); }
  }, [searchParams]);

  if (!isAuth) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  const handleReset = () => {
    clearPersistedState("tts_");
    setText(""); setVoice("hi-female"); setSpeed(1.0);
    setStatus("idle"); setAudioUrl(""); setError("");
    setIsPlaying(false); setCurrentTime(0); setAudioDuration(0);
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setStatus("generating");
    setError("");
    setAudioUrl("");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, speed }),
      });

      if (!res.ok) {
        let errorMsg = "TTS generation failed";
        try {
          const resText = await res.text();
          try {
            const data = JSON.parse(resText);
            errorMsg = data.error || errorMsg;
          } catch {
            errorMsg = `Server error: ${res.status} ${res.statusText}`;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setAudioUrl(data.audioUrl);
      setStatus("done");

      const selectedVoice = VOICES.find((v) => v.id === voice);
      addToHistory({
        type: "tts",
        title: text.substring(0, 60) + (text.length > 60 ? "..." : ""),
        status: "completed",
        data: {
          text: text.substring(0, 500),
          voice: selectedVoice?.name || voice,
          audioUrl: data.audioUrl,
        },
      });
      showToast("Voice generated!", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus("error");
      showToast("Generation failed", "error");
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) { audioRef.current.currentTime = t; setCurrentTime(t); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl + "?download=1";
    a.download = `speech-${voice}-${Date.now()}.mp3`;
    a.click();
  };

  const selectedVoice = VOICES.find((v) => v.id === voice);

  // Filter voices based on search and category tabs
  const categories = ["All", "Hindi", "English", "Spanish", "French", "German", "Other"];
  const filteredVoices = VOICES.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      v.desc.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      v.lang.toLowerCase().includes(voiceSearch.toLowerCase());
    
    if (selectedCategory === "All") return matchesSearch;
    if (selectedCategory === "Other") {
      return matchesSearch && !["Hindi", "English", "Spanish", "French", "German"].includes(v.lang);
    }
    return matchesSearch && v.lang === selectedCategory;
  });

  return (
    <div className="dashboard-layout">
      <Sidebar active="tts" />
      <div className="dashboard-content-wrapper">
        
        {/* Page Header */}
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "28px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.3rem", display: "flex", alignItems: "center", gap: "12px" }}>
            <VolumeIcon size={32} color="#FF8000" /> <span className="gradient-text">AI Voice Generator Board</span>
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
            Crystal-clear neural voices for Hindi, English &amp; 15+ languages with customizable speed &amp; tone
          </p>
        </div>

        {/* 2-COLUMN GRID: LEFT (Input Script + Parameters + Actions) | RIGHT (Select Voice Grid) */}
        <div className="teleprompter-grid fade-in" style={{ gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
          
          {/* ==================== LEFT COLUMN ==================== */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* 1. Input Script Card */}
            <div className="glass-card" style={{ padding: "22px", borderRadius: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <FileTextIcon size={18} color="#FF8000" />
                  <span>Input Script</span>
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 600, background: "rgba(0,0,0,0.04)", padding: "4px 10px", borderRadius: "100px" }}>
                  {text.length} / 5,000
                </span>
              </div>

              <textarea
                className="textarea-input"
                placeholder="यहाँ टेक्स्ट लिखें या पेस्ट करें... Type or paste text in any language!"
                value={text}
                onChange={(e) => { setText(e.target.value.substring(0, 5000)); setStatus("idle"); }}
                style={{ minHeight: "265px", resize: "vertical", fontSize: "0.95rem", padding: "14px", lineHeight: "1.6" }}
              />
            </div>

            {/* 2. Speech Parameters Card */}
            <div className="glass-card" style={{ padding: "22px", borderRadius: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: 8 }}>
                <SettingsIcon size={18} color="#FF8000" />
                <span>Speech Parameters</span>
              </h3>

              {/* Speed Slider */}
              <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)" }}>Reading Speed:</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#FF8000", background: "rgba(255,128,0,0.1)", padding: "2px 10px", borderRadius: "100px" }}>
                    {speed}x
                  </span>
                </div>
                <input
                  type="range"
                  className="speed-slider"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#FF8000" }}
                />
              </div>

              {/* Active Voice Summary pill */}
              {selectedVoice && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 128, 0, 0.06)", border: "1px border-subtle", padding: "10px 14px", borderRadius: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={selectedVoice.avatar} alt={selectedVoice.name} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--accent)" }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>{selectedVoice.name}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>({selectedVoice.lang})</span>
                  </div>
                  <CountrySvgFlag code={selectedVoice.flag} size={20} />
                </div>
              )}
            </div>

            {/* 3. Action Buttons & Status Card */}
            <div className="glass-card" style={{ padding: "22px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                className="btn btn-primary btn-large"
                onClick={handleGenerate}
                disabled={!text.trim() || status === "generating"}
                style={{
                  width: "100%",
                  height: "48px",
                  fontSize: "1rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  borderRadius: "12px",
                  boxShadow: "0 4px 14px rgba(255,128,0,0.25)"
                }}
              >
                {status === "generating" ? (
                  <><span className="spinner"></span> Generating Neural Voice...</>
                ) : (
                  <>
                    <VolumeIcon size={20} color="#0a0a0a" />
                    <span>Generate Voice</span>
                  </>
                )}
              </button>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text-dim)" }}
                onClick={handleReset}
              >
                <RefreshIcon size={14} color="currentColor" /> Reset Panel
              </button>
            </div>

            {error && (
              <div className="badge badge-error fade-in" style={{ padding: "12px 18px", fontSize: "0.9rem", display: "inline-flex", alignItems: "center", gap: 6, borderRadius: "12px" }}>
                <AlertCircleIcon size={16} color="currentColor" /> {error}
              </div>
            )}

            {/* 4. Audio Player Card (when generated) */}
            {status === "done" && audioUrl && (
              <div className="glass-card fade-in" style={{ padding: "22px", borderRadius: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <MusicIcon size={18} color="#FF8000" /> Audio Output
                  </h3>
                  <span className="badge badge-success" style={{ fontSize: "0.7rem", borderRadius: "100px", padding: "4px 10px" }}>Ready</span>
                </div>

                <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous"
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setIsPlaying(false)} />

                <Waveform audioRef={audioRef} isPlaying={isPlaying} />

                <div className="audio-player" style={{ margin: "12px 0 16px 0" }}>
                  <button className="play-btn" onClick={togglePlay} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {isPlaying ? <PauseIcon size={16} color="currentColor" /> : <PlayIcon size={16} color="currentColor" />}
                  </button>
                  <div className="audio-info">
                    <input type="range" className="audio-seek" min="0" max={audioDuration || 0}
                      step="0.1" value={currentTime} onChange={handleSeek} />
                    <div className="audio-time">{fmt(currentTime)} / {fmt(audioDuration)}</div>
                  </div>
                </div>

                <button className="btn btn-primary btn-sm" style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: "40px", borderRadius: "10px" }} onClick={downloadAudio}>
                  <DownloadIcon size={16} color="#0a0a0a" /> Download MP3 Audio
                </button>
              </div>
            )}

          </div>

          {/* ==================== RIGHT COLUMN: SELECT VOICE ==================== */}
          <div className="glass-card" style={{ padding: "22px", borderRadius: "16px", display: "flex", flexDirection: "column", minHeight: "560px" }}>
            
            {/* Header Title */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <HeadphonesIcon size={18} color="#FF8000" />
                <span>Select Voice</span>
              </h3>
              <span style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700, background: "rgba(255,128,0,0.1)", padding: "4px 10px", borderRadius: "100px" }}>
                {VOICES.length} Neural Voices
              </span>
            </div>

            {/* Voice Search Bar */}
            <div style={{ position: "relative", marginBottom: "14px" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>
                <SearchIcon size={16} color="currentColor" />
              </span>
              <input
                type="text"
                className="select-input"
                placeholder="Search voices or languages..."
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                style={{ paddingLeft: "38px", height: "40px", fontSize: "0.88rem", borderRadius: "10px" }}
              />
            </div>

            {/* Language Filter Category Tabs */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "100px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    border: selectedCategory === cat ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: selectedCategory === cat ? "rgba(255,128,0,0.12)" : "#ffffff",
                    color: selectedCategory === cat ? "var(--accent)" : "var(--text-dim)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scrollable Voice Grid List */}
            <div
              className="voice-grid"
              style={{
                overflowY: "auto",
                maxHeight: "520px",
                paddingRight: "4px",
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "10px"
              }}
            >
              {filteredVoices.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-dim)", fontSize: "0.88rem" }}>
                  No voices found matching &quot;{voiceSearch}&quot;
                </div>
              ) : (
                filteredVoices.map((v) => {
                  const isSelected = voice === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`voice-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setVoice(v.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: isSelected ? "rgba(255, 128, 0, 0.08)" : "#ffffff",
                        border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                        boxShadow: isSelected ? "0 4px 12px rgba(255, 128, 0, 0.15)" : "0 2px 4px rgba(0,0,0,0.02)",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {/* Left: Avatar + Details */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <img
                          src={v.avatar}
                          alt={v.name}
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            objectFit: "contain",
                            border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                            boxShadow: isSelected ? "0 2px 8px rgba(255,128,0,0.2)" : "none",
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.2 }}>
                              {v.name}
                            </span>
                            {isSelected && <CheckCircleIcon size={14} color="var(--accent)" />}
                          </div>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "2px", fontWeight: 500 }}>
                            {v.desc}
                          </span>
                        </div>
                      </div>

                      {/* Right: Flag */}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <CountrySvgFlag code={v.flag} size={22} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
