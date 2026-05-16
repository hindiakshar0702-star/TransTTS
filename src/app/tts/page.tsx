"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import ToolNav from "@/components/ToolNav";
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const t = searchParams.get("text");
    if (t) { setText(t); setStatus("idle"); }
  }, [searchParams]);

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
    <>
      <Navbar />
      <main className="app-page">
        <div className="container">
          <div className="app-header fade-in">
            <h1>🔊 <span className="gradient-text">AI Voice Generator</span></h1>
            <p>Crystal-clear neural voices for Hindi, English &amp; 15+ languages — completely FREE!</p>
          </div>

          <ToolNav />

          {/* Free badge */}
          <div className="fade-in" style={{ marginBottom: 24 }}>
            <span className="badge badge-success" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
              🆓 Powered by Microsoft Neural TTS — No API Key Needed
            </span>
          </div>

          {/* Text input */}
          <div className="fade-in">
            <label className="form-label">Enter Text</label>
            <textarea
              className="textarea-input"
              placeholder="यहाँ टेक्स्ट लिखें या पेस्ट करें... Type or paste text in any language!"
              value={text}
              onChange={(e) => { setText(e.target.value.substring(0, 5000)); setStatus("idle"); }}
              style={{ minHeight: 180 }}
            />
            <div className="char-count">{text.length} / 5,000 characters</div>
          </div>

          {/* Voice selection */}
          <div className="fade-in" style={{ marginTop: 24 }}>
            <label className="form-label">🎧 Select Voice ({VOICES.length} Neural Voices Available)</label>
            <div className="voice-grid">
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

          {/* Speed control */}
          <div className="fade-in" style={{ marginTop: 16 }}>
            <div className="speed-control">
              <span className="speed-label">Speed:</span>
              <input type="range" className="speed-slider" min="0.5" max="2.0" step="0.1"
                value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
              <span className="speed-value">{speed}x</span>
            </div>
          </div>

          {/* Selected voice info */}
          {selectedVoice && (
            <div className="fade-in" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-info">Voice: {selectedVoice.name}</span>
              <span className="badge badge-info">Language: {selectedVoice.lang}</span>
              <span className="badge badge-info">Speed: {speed}x</span>
            </div>
          )}

          {/* Generate button */}
          <button
            className="btn btn-primary btn-large fade-in"
            style={{ width: "100%", marginTop: 24 }}
            onClick={handleGenerate}
            disabled={!text.trim() || status === "generating"}
          >
            {status === "generating" ? (
              <><span className="spinner"></span> Generating Neural Voice...</>
            ) : (
              "🔊 Generate Voice"
            )}
          </button>

          {error && (
            <div className="badge badge-error" style={{ padding: "12px 18px", fontSize: "0.9rem", marginTop: 12 }}>
              ❌ {error}
            </div>
          )}

          {/* Audio player */}
          {status === "done" && audioUrl && (
            <div className="fade-in" style={{ marginTop: 24 }}>
              <div className="glass-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3>🎵 Generated Audio</h3>
                  <span className="badge badge-success">✅ Ready to Play</span>
                </div>

                <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous"
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setIsPlaying(false)} />

                <Waveform audioRef={audioRef} isPlaying={isPlaying} />

                <div className="audio-player">
                  <button className="play-btn" onClick={togglePlay}>
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <div className="audio-info">
                    <input type="range" className="audio-seek" min="0" max={audioDuration || 0}
                      step="0.1" value={currentTime} onChange={handleSeek} />
                    <div className="audio-time">{fmt(currentTime)} / {fmt(audioDuration)}</div>
                  </div>
                </div>

                <div className="action-bar" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={downloadAudio}>📥 Download MP3</button>
                  <button className="btn btn-ghost" onClick={handleReset}>🔄 Generate New</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
