"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useToast } from "@/components/Toast";
import ExportModal from "@/components/ExportModal";
import ProgressTracker from "@/components/ProgressTracker";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import { LANGUAGES, formatDuration, formatFileSize, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MAX_UPLOAD_PARTS, TRANSCRIPT_CONTEXT_CHARS, languageCodeFromName } from "@/lib/utils";
import { prepareUpload, partFileName } from "@/lib/audioSplit";
import {
  MicIcon, VolumeIcon, GlobeIcon, SparklesIcon,
  FileTextIcon, SaveIcon, XIcon, ClockIcon, DownloadIcon,
  RefreshIcon, CopyIcon, AlertCircleIcon, UploadIcon, CheckCircleIcon
} from "@/components/Icons";
import type { TranscriptSegment } from "@/types";

export default function TranscribePage() {
  const [isAuth, setIsAuth] = useState(false);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
    }
  }, []);

  const handleReset = () => {
    clearPersistedState("transcribe_");
    setFile(null); setLanguage("auto"); setStatus("idle");
    setProgress(0); setTranscript(""); setSegments([]);
    setDetectedLang(""); setDuration(0); setError("");
  };

  const handleFile = (f: File) => {
    // Bigger than one request is fine — it gets split before upload. Bigger
    // than every request put together is not.
    const ceiling = MAX_UPLOAD_BYTES * MAX_UPLOAD_PARTS;
    if (f.size > ceiling) {
      setError(
        `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_UPLOAD_MB * MAX_UPLOAD_PARTS} MB.`
      );
      return;
    }
    setFile(f);
    setError("");
    setTranscript("");
    setSegments([]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(4);
    setError("");

    let tick: ReturnType<typeof setInterval> | undefined;
    try {
      // Anything over the host's request limit is cut client-side and sent as
      // several uploads, then stitched back into one transcript.
      const prepared = await prepareUpload(file, MAX_UPLOAD_BYTES);
      const total = prepared.parts.length;

      if (total > MAX_UPLOAD_PARTS) {
        throw new Error(
          `This file would need ${total} uploads of ${MAX_UPLOAD_MB} MB. The limit is ${MAX_UPLOAD_PARTS} — please trim it first.`
        );
      }
      if (total > 1) {
        showToast(`Large file — sending in ${total} parts`, "info");
      }

      const texts: string[] = [];
      const allSegments: TranscriptSegment[] = [];
      let offsetSeconds = 0;
      let detected = "";
      let pinnedLanguage = language;

      for (let i = 0; i < total; i++) {
        const part = prepared.parts[i];
        const partFloor = 4 + (i / total) * 92;
        const partCeiling = 4 + ((i + 1) / total) * 92;
        setProgress(Math.round(partFloor));

        // The server transcribes synchronously, so creep towards this part's
        // share of the bar while waiting on it.
        clearInterval(tick);
        tick = setInterval(
          () => setProgress((p) => Math.min(p + 2, Math.round(partCeiling) - 2)),
          700
        );

        const formData = new FormData();
        formData.append("file", part.blob, partFileName(file.name, i, total, part.blob.type));
        // Parts after the first inherit the language detected in the first.
        // Left on "auto" they are each detected independently, and a part that
        // guesses wrong transcribes the speech phonetically into that other
        // language — the transcript changes language mid-sentence.
        formData.append("language", pinnedLanguage);
        // The tail of what has been transcribed so far, so Whisper continues
        // rather than restarting cold at every boundary.
        if (texts.length > 0) {
          formData.append("context", texts.join(" ").slice(-TRANSCRIPT_CONTEXT_CHARS));
        }

        const res = await fetch("/api/transcribe", { method: "POST", body: formData });

        if (!res.ok) {
          let errorMsg = total > 1 ? `Transcription failed on part ${i + 1} of ${total}` : "Transcription failed";
          try {
            const text = await res.text();
            try {
              const data = JSON.parse(text);
              errorMsg = data.error || errorMsg;
            } catch {
              if (res.status === 413 || text.includes("Request Entity Too Large")) {
                errorMsg = `The server rejected this upload as too large. Maximum is ${MAX_UPLOAD_MB} MB.`;
              } else {
                errorMsg = `Server error: ${res.status} ${res.statusText}`;
              }
            }
          } catch {}
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.text) texts.push(String(data.text).trim());
        if (!detected && data.language) {
          detected = data.language;
          // Whisper reports a name but accepts a code, and only knows some of
          // them here; an unmappable language stays on auto-detection.
          if (pinnedLanguage === "auto") {
            pinnedLanguage = languageCodeFromName(detected) || "auto";
          }
        }

        // Each part is transcribed in isolation, so its timestamps start at
        // zero and have to be pushed to where the part actually sits.
        for (const segment of (data.segments || []) as TranscriptSegment[]) {
          allSegments.push({
            id: allSegments.length,
            start: segment.start + offsetSeconds,
            end: segment.end + offsetSeconds,
            text: segment.text,
          });
        }

        offsetSeconds += Number(data.duration) || part.seconds;
      }

      clearInterval(tick);
      setProgress(100);
      setTranscript(texts.join(" "));
      setSegments(allSegments);
      setDetectedLang(detected);
      setDuration(offsetSeconds);
      setStatus("done");

      addToHistory({
        type: "transcribe",
        title: file?.name || "Audio Transcription",
        status: "completed",
        data: {
          fileName: file?.name,
          fileSize: file?.size,
          language: detected,
          duration: offsetSeconds,
          transcript: texts.join(" "),
          segmentCount: allSegments.length,
          uploadParts: total,
        },
      });
      showToast("Transcription complete!", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
      setProgress(0);
      showToast("Transcription failed", "error");
    } finally {
      clearInterval(tick);
    }
  };


  const copyTranscript = () => {
    navigator.clipboard.writeText(transcript);
    showToast("Transcript copied!", "success");
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
      <Sidebar active="transcribe" />
      <div className="dashboard-content-wrapper">
        
        {/* Page Header */}
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "28px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.3rem", display: "flex", alignItems: "center", gap: "12px" }}>
            <MicIcon size={32} color="#FF8000" /> <span className="gradient-text">Audio Transcription</span>
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
            Upload audio or video — Whisper AI converts speech to text with precise timestamps
          </p>
        </div>

        {/* MAIN CONTAINER / UPLOAD ZONE */}
        {status === "idle" || status === "error" ? (
          <div className="fade-in" style={{ maxWidth: "720px", margin: "0 auto" }}>
            
            {/* Glass Card Wrapper */}
            <div className="glass-card" style={{ padding: "28px", borderRadius: "20px", border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.03)" }}>
              
              {/* Dropzone Area */}
              <div
                className={`dropzone ${dragOver ? "dragover" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  padding: "40px 24px",
                  borderRadius: "14px",
                  border: dragOver ? "2px dashed #FF8000" : "2px dashed rgba(255, 128, 0, 0.35)",
                  background: dragOver ? "rgba(255, 128, 0, 0.08)" : "rgba(255, 128, 0, 0.02)",
                  transition: "all 0.25s ease",
                  cursor: "pointer",
                  textAlign: "center"
                }}
              >
                {/* Icon Badge */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255, 128, 0, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <UploadIcon size={26} color="#FF8000" />
                  </div>
                </div>

                <div style={{ fontSize: "1.08rem", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                  Drag &amp; drop your audio or video file
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", fontWeight: 500 }}>
                  MP3, WAV, MP4, MKV, FLAC, OGG, WebM • Max {MAX_UPLOAD_MB * MAX_UPLOAD_PARTS} MB
                </div>
                
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </div>

              {/* Selected File Card */}
              {file && (
                <div className="file-preview fade-in" style={{ marginTop: "18px", padding: "12px 16px", borderRadius: "12px", background: "#ffffff", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <div className="file-preview-info">
                    <span style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,128,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileTextIcon size={18} color="#FF8000" />
                    </span>
                    <div>
                      <div className="file-preview-name" style={{ fontWeight: 700, fontSize: "0.9rem" }}>{file.name}</div>
                      <div className="file-preview-size" style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => { setFile(null); setError(""); }} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: "32px", fontSize: "0.8rem", borderRadius: "8px" }}>
                    <XIcon size={14} color="currentColor" /> Remove
                  </button>
                </div>
              )}

              {/* Sleek Compact Controls Row (Dropdown & Button compact height ~40px) */}
              <div className="form-action-row" style={{ display: "flex", alignItems: "flex-end", gap: "14px", marginTop: "20px" }}>
                
                {/* Compact Dropdown */}
                <div style={{ flex: "0 0 210px" }}>
                  <label className="form-label" style={{ marginBottom: "6px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    Language
                  </label>
                  <select
                    className="select-input"
                    aria-label="Transcription language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ height: "40px", padding: "0 34px 0 14px", fontSize: "0.88rem", borderRadius: "10px" }}
                  >
                    {Object.entries(LANGUAGES).map(([code, lang]) => (
                      <option key={code} value={code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compact Start Button */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleTranscribe}
                  disabled={!file}
                  style={{
                    height: "40px",
                    padding: "0 22px",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    borderRadius: "100px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    flexShrink: 0,
                    boxShadow: file ? "0 4px 12px rgba(255,128,0,0.22)" : "none"
                  }}
                >
                  <SparklesIcon size={16} color="#0a0a0a" />
                  <span>Start Transcription</span>
                </button>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "6px" }}>
                Auto Detect works best for most audio files
              </div>


              {/* Error Badge */}
              {error && (
                <div className="badge badge-error" style={{ padding: "10px 14px", fontSize: "0.85rem", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: "10px", width: "100%" }}>
                  <AlertCircleIcon size={16} color="currentColor" /> {error}
                </div>
              )}

              {/* Feature Highlights Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "24px", paddingTop: "18px", borderTop: "1px dashed var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 600 }}>
                  <CheckCircleIcon size={14} color="#FF8000" /> Whisper AI V3
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 600 }}>
                  <CheckCircleIcon size={14} color="#FF8000" /> 99+ Languages
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 600 }}>
                  <CheckCircleIcon size={14} color="#FF8000" /> Export SRT &amp; TXT
                </div>
              </div>

            </div>

          </div>
        ) : null}

        {/* PROGRESS STATE */}
        {status === "uploading" && (
          <div className="fade-in" style={{ marginTop: 24, maxWidth: "680px", margin: "24px auto 0" }}>
            <div className="glass-card" style={{ textAlign: "center", padding: "40px 28px", borderRadius: "20px" }}>
              <div className="spinner" style={{ margin: "0 auto 16px", width: 34, height: 34 }}></div>
              <h3 style={{ marginBottom: 8, fontSize: "1.2rem", fontWeight: 700 }}>Transcribing with Whisper AI...</h3>
              <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: "0.9rem" }}>
                Processing continues in the background — you can keep this tab open and watch live progress.
              </p>
              <ProgressTracker progress={progress} status={status} />
            </div>
          </div>
        )}

        {/* RESULTS STATE */}
        {status === "done" && (
          <div className="fade-in" style={{ maxWidth: "860px", margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span className="badge badge-success" style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "0.78rem" }}>
                Transcription Complete
              </span>
              {detectedLang && (
                <span className="badge badge-info" style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "0.78rem" }}>
                  {LANGUAGES[detectedLang]?.name || detectedLang}
                </span>
              )}
              {duration > 0 && (
                <span className="badge badge-info" style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "0.78rem" }}>
                  {formatDuration(duration)}
                </span>
              )}
            </div>

            {/* Full transcript card */}
            <div className="glass-card" style={{ marginBottom: 16, padding: "24px", borderRadius: "16px" }}>
              <div className="edit-bar" style={{ marginBottom: "14px" }}>
                <h3 style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  <FileTextIcon size={18} color="#FF8000" />
                  <span>Full Transcript</span>
                </h3>
                {!isEditing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setOriginalTranscript(transcript);
                      setIsEditing(true);
                    }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={copyTranscript} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CopyIcon size={14} color="currentColor" /> Copy
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      setIsEditing(false);
                      showToast("Transcript saved!", "success");
                    }} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <SaveIcon size={14} color="#0a0a0a" /> Save
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setTranscript(originalTranscript);
                      setIsEditing(false);
                    }} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <XIcon size={14} color="currentColor" /> Cancel
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <textarea
                  className="editable-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  style={{ minHeight: "180px", borderRadius: "10px", padding: "14px", fontSize: "0.95rem" }}
                />
              ) : (
                <p style={{ lineHeight: 1.8, fontSize: "0.95rem", color: "var(--text)" }}>{transcript}</p>
              )}
            </div>

            {/* Segments card */}
            {segments.length > 0 && (
              <div className="transcript-box" style={{ padding: "24px", borderRadius: "16px", marginBottom: "16px" }}>
                <h3 style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 8, fontSize: "1.05rem", fontWeight: 700 }}>
                  <ClockIcon size={18} color="#FF8000" /> Timestamped Segments
                </h3>
                {segments.map((seg) => (
                  <div key={seg.id} className="segment">
                    <span className="segment-time" style={{ color: "#FF8000", fontWeight: 600 }}>[{formatDuration(seg.start)}]</span>
                    <span className="segment-text">{seg.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions bar */}
            <div className="action-bar" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowExport(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "38px", borderRadius: "100px" }}>
                <DownloadIcon size={16} color="#0a0a0a" /> Export Transcript
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => {
                router.push(`/translate?text=${encodeURIComponent(transcript.substring(0, 2000))}`);
              }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "38px", borderRadius: "100px" }}>
                <GlobeIcon size={16} color="currentColor" /> Translate
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => {
                router.push(`/tts?text=${encodeURIComponent(transcript.substring(0, 500))}`);
              }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "38px", borderRadius: "100px" }}>
                <VolumeIcon size={16} color="currentColor" /> Generate Voice
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleReset} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "38px", borderRadius: "100px" }}>
                <RefreshIcon size={16} color="currentColor" /> New Transcription
              </button>
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
    </div>
  );
}
