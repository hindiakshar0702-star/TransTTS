"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useToast } from "@/components/Toast";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import Waveform from "@/components/Waveform";

const VOICES = [
  { id: "hi-female", name: "Swara", desc: "🇮🇳 Hindi Female", lang: "Hindi" },
  { id: "hi-male", name: "Madhur", desc: "🇮🇳 Hindi Male", lang: "Hindi" },
  { id: "en-female", name: "Jenny", desc: "🇺🇸 English Female", lang: "English" },
  { id: "en-male", name: "Guy", desc: "🇺🇸 English Male", lang: "English" },
  { id: "en-uk-female", name: "Sonia", desc: "🇬🇧 British Female", lang: "English" },
  { id: "en-uk-male", name: "Ryan", desc: "🇬🇧 British Male", lang: "English" },
  { id: "es-female", name: "Elvira", desc: "🇪🇸 Spanish Female", lang: "Spanish" },
  { id: "fr-female", name: "Denise", desc: "🇫🇷 French Female", lang: "French" },
  { id: "de-female", name: "Katja", desc: "🇩🇪 German Female", lang: "German" },
  { id: "ja-female", name: "Nanami", desc: "🇯🇵 Japanese Female", lang: "Japanese" },
  { id: "bn-female", name: "Tanishaa", desc: "🇮🇳 Bengali Female", lang: "Bengali" },
  { id: "ta-female", name: "Pallavi", desc: "🇮🇳 Tamil Female", lang: "Tamil" },
  { id: "te-female", name: "Shruti", desc: "🇮🇳 Telugu Female", lang: "Telugu" },
  { id: "mr-female", name: "Aarohi", desc: "🇮🇳 Marathi Female", lang: "Marathi" },
  { id: "gu-female", name: "Dhwani", desc: "🇮🇳 Gujarati Female", lang: "Gujarati" },
  { id: "ur-male", name: "Asad", desc: "🇵🇰 Urdu Male", lang: "Urdu" },
  { id: "ar-male", name: "Hamed", desc: "🇸🇦 Arabic Male", lang: "Arabic" },
  { id: "pt-female", name: "Francisca", desc: "🇧🇷 Portuguese Female", lang: "Portuguese" },
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
  const router = useRouter();
  const [text, setText] = usePersistedState("tts_text", "");
  const [voice, setVoice] = usePersistedState("tts_voice", "hi-female");
  const [speed, setSpeed] = usePersistedState("tts_speed", 1.0);
  const [status, setStatus] = usePersistedState<"idle" | "generating" | "done" | "error">("tts_status", "idle");
  const [audioUrl, setAudioUrl] = usePersistedState("tts_audioUrl", "");
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { showToast } = useToast();

  // Auth Guard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      if (!loggedIn) {
        showToast("Please sign in to access this tool.", "error");
        router.push("/login?redirect=/tts");
      } else {
        setIsAuth(true);
      }
    }
  }, [router]);

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
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorMsg = data.error || errorMsg;
          } catch (e) {
            errorMsg = `Server error: ${res.status} ${res.statusText}`;
          }
        } catch (e) {}
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

  return (
    <div className="dashboard-layout">
      <Sidebar active="tts" />
      <div className="dashboard-content-wrapper">
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "32px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.4rem", display: "flex", alignItems: "center", gap: "12px" }}>
            🔊 <span className="gradient-text">AI Voice Generator Board</span>
          </h1>
          <p>Crystal-clear neural voices for Hindi, English &amp; 15+ languages in a modular grid</p>
        </div>

          {/* Free badge */}
          <div className="fade-in" style={{ marginBottom: 24 }}>
            <span className="badge badge-success" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
              🆓 Powered by Microsoft Neural TTS — No API Key Needed
            </span>
          </div>

          {/* Modular Grid Layout */}
          <div className="teleprompter-grid fade-in" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", height: "auto" }}>
            
            {/* LEFT COLUMN: Text input & Voice selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Text Input module */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px" }}>📝 Input Script</h3>
                <textarea
                  className="textarea-input"
                  placeholder="यहाँ टेक्स्ट लिखें या पेस्ट करें... Type or paste text in any language!"
                  value={text}
                  onChange={(e) => { setText(e.target.value.substring(0, 5000)); setStatus("idle"); }}
                  style={{ minHeight: "150px", resize: "vertical" }}
                />
                <div className="char-count" style={{ marginTop: "8px" }}>{text.length} / 5,000 characters</div>
              </div>

              {/* Voice Grid Selection module */}
              <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px" }}>
                  🎧 Select Voice ({VOICES.length} Neural Voices Available)
                </h3>
                <div className="voice-grid" style={{ overflowY: "auto", maxHeight: "280px", paddingRight: "6px" }}>
                  {VOICES.map((v) => (
                    <div
                      key={v.id}
                      className={`voice-card ${voice === v.id ? "selected" : ""}`}
                      onClick={() => setVoice(v.id)}
                    >
                      <div className="voice-name">{v.name}</div>
                      <div className="voice-desc">{v.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Settings, Actions, & Audio Preview */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Voice settings module */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>⚙️ Speech Parameters</h3>
                
                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <div className="speed-control">
                    <span className="speed-label">Speed:</span>
                    <input type="range" className="speed-slider" min="0.5" max="2.0" step="0.1"
                      value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
                    <span className="speed-value">{speed}x</span>
                  </div>
                </div>

                {selectedVoice && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                    <div style={{ fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Voice Actor:</span>
                      <span style={{ fontWeight: 600 }}>{selectedVoice.name}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Language:</span>
                      <span style={{ fontWeight: 600 }}>{selectedVoice.lang}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons card */}
              <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={!text.trim() || status === "generating"}
                  style={{ width: "100%" }}
                >
                  {status === "generating" ? (
                    <><span className="spinner"></span> Generating Neural Voice...</>
                  ) : (
                    "🔊 Generate Voice"
                  )}
                </button>

                <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={handleReset}>
                  🔄 Reset Panel
                </button>
              </div>

              {error && (
                <div className="badge badge-error fade-in" style={{ padding: "12px 18px", fontSize: "0.9rem", display: "block" }}>
                  ❌ {error}
                </div>
              )}

              {/* Audio player card */}
              {status === "done" && audioUrl && (
                <div className="glass-card fade-in" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>🎵 Audio Playback</h3>
                    <span className="badge badge-success" style={{ fontSize: "0.68rem" }}>Ready</span>
                  </div>

                  <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous"
                    onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                    onEnded={() => setIsPlaying(false)} />

                  <Waveform audioRef={audioRef} isPlaying={isPlaying} />

                  <div className="audio-player" style={{ margin: "12px 0 16px 0" }}>
                    <button className="play-btn" onClick={togglePlay}>
                      {isPlaying ? "⏸" : "▶"}
                    </button>
                    <div className="audio-info">
                      <input type="range" className="audio-seek" min="0" max={audioDuration || 0}
                        step="0.1" value={currentTime} onChange={handleSeek} />
                      <div className="audio-time">{fmt(currentTime)} / {fmt(audioDuration)}</div>
                    </div>
                  </div>

                  <button className="btn btn-primary btn-sm" style={{ width: "100%" }} onClick={downloadAudio}>
                    📥 Download MP3
                  </button>
                </div>
              )}

            </div>

          </div>

      </div>
    </div>
  );
}
