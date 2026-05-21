"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ToolNav from "@/components/ToolNav";
import { useToast } from "@/components/Toast";
import ExportModal from "@/components/ExportModal";
import ProgressTracker from "@/components/ProgressTracker";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import { LANGUAGES, formatDuration, formatFileSize } from "@/lib/utils";
import type { TranscriptSegment } from "@/types";

export default function TranscribePage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = usePersistedState("transcribe_lang", "auto");
  const [status, setStatus] = usePersistedState<"idle" | "uploading" | "done" | "error">("transcribe_status", "idle");
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = usePersistedState("transcribe_text", "");
  const [segments, setSegments] = usePersistedState<TranscriptSegment[]>("transcribe_segments", []);
  const [detectedLang, setDetectedLang] = usePersistedState("transcribe_detected", "");
  const [duration, setDuration] = usePersistedState("transcribe_duration", 0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [showExport, setShowExport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleReset = () => {
    clearPersistedState("transcribe_");
    setFile(null); setLanguage("auto"); setStatus("idle");
    setProgress(0); setTranscript(""); setSegments([]);
    setDetectedLang(""); setDuration(0); setError("");
  };

  const handleFile = useCallback((f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      setError("File too large. Maximum 25MB for Whisper API.");
      return;
    }
    setFile(f);
    setError("");
    setTranscript("");
    setSegments([]);
  }, [setTranscript, setSegments]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(10);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);

      setProgress(30);
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 90));
      }, 800);

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      clearInterval(interval);

      if (!res.ok) {
        let errorMsg = "Transcription failed";
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorMsg = data.error || errorMsg;
          } catch (e) {
            if (res.status === 413 || text.includes("Request Entity Too Large")) {
              errorMsg = "File too large. Maximum size is 25MB or determined by your server limits.";
            } else {
              errorMsg = `Server error: ${res.status} ${res.statusText}`;
            }
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setProgress(100);
      setTranscript(data.text);
      setSegments(data.segments || []);
      setDetectedLang(data.language);
      setDuration(data.duration);
      setStatus("done");

      addToHistory({
        type: "transcribe",
        title: file?.name || "Audio Transcription",
        status: "completed",
        data: {
          fileName: file?.name,
          fileSize: file?.size,
          language: data.language,
          duration: data.duration,
          transcript: data.text,
          segmentCount: (data.segments || []).length,
        },
      });
      showToast("Transcription complete!", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
      setProgress(0);
      showToast("Transcription failed", "error");
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(transcript);
    showToast("Transcript copied!", "success");
  };

  const downloadTxt = () => {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSrt = () => {
    const srt = segments
      .map((seg, i) => {
        const start = formatSrtTime(seg.start);
        const end = formatSrtTime(seg.end);
        return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
      })
      .join("\n");
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSrtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(sec)},${ms.toString().padStart(3, "0")}`;
  };
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container">
          <div className="app-header fade-in">
            <h1>🎤 <span className="gradient-text">Audio Transcription</span></h1>
            <p>Upload audio or video — Whisper AI converts it to text with timestamps</p>
          </div>

          <ToolNav />

          {/* UPLOAD ZONE */}
          {status === "idle" || status === "error" ? (
            <div className="fade-in">
              <div
                className={`dropzone ${dragOver ? "dragover" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="dropzone-icon">📂</div>
                <div className="dropzone-text">Drag &amp; drop your audio or video file</div>
                <div className="dropzone-hint">
                  MP3, WAV, MP4, MKV, FLAC, OGG, WebM • Max 25 MB
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {file && (
                <div className="file-preview fade-in">
                  <div className="file-preview-info">
                    <span className="file-preview-icon">
                      {file.type.startsWith("video") ? "🎬" : "🎵"}
                    </span>
                    <div>
                      <div className="file-preview-name">{file.name}</div>
                      <div className="file-preview-size">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => { setFile(null); setError(""); }}>
                    ✕ Remove
                  </button>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 20 }}>
                <label className="form-label">Language</label>
                <select className="select-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {Object.entries(LANGUAGES).map(([code, lang]) => (
                    <option key={code} value={code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
                <div className="form-hint">Auto Detect works best for most files</div>
              </div>

              {error && (
                <div className="badge badge-error" style={{ padding: "12px 18px", fontSize: "0.9rem", marginTop: 12 }}>
                  ❌ {error}
                </div>
              )}

              <button
                className="btn btn-primary btn-large"
                style={{ width: "100%", marginTop: 16 }}
                onClick={handleTranscribe}
                disabled={!file}
              >
                🚀 Start Transcription
              </button>
            </div>
          ) : null}

          {/* PROGRESS */}
          {status === "uploading" && (
            <div className="fade-in" style={{ marginTop: 24 }}>
              <div className="glass-card" style={{ textAlign: "center", padding: 40 }}>
                <div className="spinner" style={{ margin: "0 auto 16px", width: 32, height: 32 }}></div>
                <h3 style={{ marginBottom: 8 }}>Transcribing with Whisper AI...</h3>
                <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
                  This may take 30-60 seconds depending on file length
                </p>
                <ProgressTracker progress={progress} status={status} />
              </div>
            </div>
          )}

          {/* RESULTS */}
          {status === "done" && (
            <div className="fade-in">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <span className="badge badge-success">✅ Transcription Complete</span>
                {detectedLang && (
                  <span className="badge badge-info">
                    🌐 {LANGUAGES[detectedLang]?.name || detectedLang}
                  </span>
                )}
                {duration > 0 && (
                  <span className="badge badge-info">⏱️ {formatDuration(duration)}</span>
                )}
              </div>

              {/* Full transcript */}
              <div className="glass-card" style={{ marginBottom: 16 }}>
                <div className="edit-bar">
                  <h3 style={{ flex: 1 }}>📝 Full Transcript</h3>
                  {!isEditing ? (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setOriginalTranscript(transcript);
                        setIsEditing(true);
                      }}>✏️ Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={copyTranscript}>📋 Copy</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        setIsEditing(false);
                        showToast("Transcript saved!", "success");
                      }}>💾 Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setTranscript(originalTranscript);
                        setIsEditing(false);
                      }}>✕ Cancel</button>
                    </>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    className="editable-transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                ) : (
                  <p style={{ lineHeight: 1.8, fontSize: "0.95rem" }}>{transcript}</p>
                )}
              </div>

              {/* Segments */}
              {segments.length > 0 && (
                <div className="transcript-box">
                  <h3 style={{ marginBottom: 16 }}>⏱️ Timestamped Segments</h3>
                  {segments.map((seg) => (
                    <div key={seg.id} className="segment">
                      <span className="segment-time">[{formatDuration(seg.start)}]</span>
                      <span className="segment-text">{seg.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="action-bar">
                <button className="btn btn-primary" onClick={() => setShowExport(true)}>📥 Export Transcript</button>
                <button className="btn btn-outline" onClick={() => {
                  router.push(`/translate?text=${encodeURIComponent(transcript.substring(0, 2000))}`);
                }}>🌐 Translate</button>
                <button className="btn btn-outline" onClick={() => {
                  router.push(`/tts?text=${encodeURIComponent(transcript.substring(0, 500))}`);
                }}>🔊 Generate Voice</button>
                <button className="btn btn-ghost" onClick={handleReset}>🔄 New Transcription</button>
              </div>

              <ExportModal
                isOpen={showExport}
                onClose={() => setShowExport(false)}
                transcript={transcript}
                segments={segments}
                fileName={file?.name}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
