"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useToast } from "@/components/Toast";
import ExportModal from "@/components/ExportModal";
import ProgressTracker from "@/components/ProgressTracker";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import { LANGUAGES, formatDuration, formatFileSize, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MAX_UPLOAD_PARTS, TRANSCRIPT_CONTEXT_CHARS, languageCodeFromName } from "@/lib/utils";
import { prepareUpload, partFileName } from "@/lib/audioSplit";
import { RadioIcon, VolumeIcon, GlobeIcon, SparklesIcon, FileTextIcon, SaveIcon, XIcon, ClockIcon, DownloadIcon, RefreshIcon, CopyIcon } from "@/components/Icons";
import type { TranscriptSegment } from "@/types";
import VoiceRecorderTeleprompter from "@/components/VoiceRecorderTeleprompter";

export default function RecordPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = usePersistedState("record_lang", "auto");
  const [status, setStatus] = usePersistedState<"idle" | "uploading" | "done" | "error">("record_status", "idle");
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = usePersistedState("record_text", "");
  const [segments, setSegments] = usePersistedState<TranscriptSegment[]>("record_segments", []);
  const [detectedLang, setDetectedLang] = usePersistedState("record_detected", "");
  const [duration, setDuration] = usePersistedState("record_duration", 0);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [showExport, setShowExport] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  // Enable tool usage directly
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
    }
  }, []);

  const handleReset = () => {
    clearPersistedState("record_");
    setFile(null); setLanguage("auto"); setStatus("idle");
    setProgress(0); setTranscript(""); setSegments([]);
    setDetectedLang(""); setDuration(0); setError("");
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(10);
    setError("");

    let interval: ReturnType<typeof setInterval> | undefined;
    try {
      // A recording longer than a few minutes outgrows one request, so it is
      // cut client-side and the transcripts are stitched back together.
      const prepared = await prepareUpload(file, MAX_UPLOAD_BYTES);
      const total = prepared.parts.length;

      if (total > MAX_UPLOAD_PARTS) {
        throw new Error(
          `This recording would need ${total} uploads of ${MAX_UPLOAD_MB} MB. The limit is ${MAX_UPLOAD_PARTS} — please record in shorter takes.`
        );
      }
      if (total > 1) showToast(`Long recording — sending in ${total} parts`, "info");

      const texts: string[] = [];
      const allSegments: TranscriptSegment[] = [];
      let offsetSeconds = 0;
      let detected = "";
      let pinnedLanguage = language;

      for (let i = 0; i < total; i++) {
        const part = prepared.parts[i];
        const partCeiling = 10 + ((i + 1) / total) * 86;
        setProgress(Math.round(10 + (i / total) * 86));

        clearInterval(interval);
        interval = setInterval(() => {
          setProgress((p) => Math.min(p + 3, Math.round(partCeiling) - 2));
        }, 800);

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
                errorMsg = `The server rejected this recording as too large. Maximum is ${MAX_UPLOAD_MB} MB.`;
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

        // Part timestamps start at zero; shift them to where the part sits.
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

      clearInterval(interval);
      setProgress(100);
      setTranscript(texts.join(" "));
      setSegments(allSegments);
      setDetectedLang(detected);
      setDuration(offsetSeconds);
      setStatus("done");

      addToHistory({
        type: "transcribe",
        title: file?.name || "Voice Recording Transcription",
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
      if (interval) clearInterval(interval);
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
      <Sidebar active="record" />
      <div className="dashboard-content-wrapper">
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "32px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.4rem", display: "flex", alignItems: "center", gap: "12px" }}>
            <RadioIcon size={32} color="#FF8000" /> <span className="gradient-text">Voice Recorder & Teleprompter</span>
          </h1>
          <p>Record your script with live active noise cancellation and transcribe it instantly</p>
        </div>

          {/* RECORDER SECTION */}
          {status === "idle" && !file && (
            <VoiceRecorderTeleprompter
              onSave={(recordedFile) => {
                setFile(recordedFile);
              }}
              onCancel={() => {
                setFile(null);
              }}
            />
          )}

          {/* CONFIRMATION / CHOOSE LANGUAGE CARD BEFORE TRANSCRIBING */}
          {status === "idle" && file && (
            <div className="fade-in">
              <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto", padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <RadioIcon size={44} color="#FF8000" />
                </div>
                <h3 style={{ textAlign: "center", marginBottom: 8 }}>Voice Recording Ready!</h3>
                <p style={{ color: "var(--text-dim)", textAlign: "center", fontSize: "0.9rem", marginBottom: 24 }}>
                  Successfully captured audio: <strong>{file.name}</strong> ({formatFileSize(file.size)})
                </p>

                <div className="form-group">
                  <label className="form-label">Select Audio Language</label>
                  <select className="select-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {Object.entries(LANGUAGES).map(([code, lang]) => (
                      <option key={code} value={code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <div className="form-hint">Choose the language spoken in the audio for higher Whisper precision</div>
                </div>

                {error && (
                  <div className="badge badge-error" style={{ padding: "12px 18px", fontSize: "0.9rem", marginTop: 12, width: "100%", justifyContent: "center" }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleReset}>
                    Record Again
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={handleTranscribe}>
                    <SparklesIcon size={16} color="#0a0a0a" />
                    <span>Start AI Transcription</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ERROR RETRY VIEW */}
          {status === "error" && (
            <div className="fade-in">
              <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: 32 }}>
                <h3 style={{ marginBottom: 8 }}>Transcription Failed</h3>
                <p style={{ color: "var(--error)", fontSize: "0.9rem", marginBottom: 24 }}>
                  {error || "An unexpected error occurred during processing."}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button className="btn btn-outline" onClick={handleReset}>
                    Discard &amp; Restart
                  </button>
                  <button className="btn btn-primary" onClick={handleTranscribe}>
                    Retry Transcription
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PROGRESS VIEW */}
          {status === "uploading" && (
            <div className="fade-in" style={{ marginTop: 24 }}>
              <div className="glass-card" style={{ textAlign: "center", padding: 40 }}>
                <div className="spinner" style={{ margin: "0 auto 16px", width: 32, height: 32 }}></div>
                <h3 style={{ marginBottom: 8 }}>Transcribing Recording with Whisper AI...</h3>
                <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
                  This may take 15-40 seconds depending on speech duration
                </p>
                <ProgressTracker progress={progress} status={status} />
              </div>
            </div>
          )}

          {/* RESULTS VIEW */}
          {status === "done" && (
            <div className="fade-in">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <span className="badge badge-success">Transcription Complete</span>
                {detectedLang && (
                  <span className="badge badge-info">
                    {LANGUAGES[detectedLang]?.name || detectedLang}
                  </span>
                )}
                {duration > 0 && (
                  <span className="badge badge-info">{formatDuration(duration)}</span>
                )}
              </div>

              {/* Full transcript */}
              <div className="glass-card" style={{ marginBottom: 16 }}>
                <div className="edit-bar">
                  <h3 style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileTextIcon size={18} color="#FF8000" />
                    <span>Full Transcript</span>
                  </h3>
                  {!isEditing ? (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setOriginalTranscript(transcript);
                        setIsEditing(true);
                      }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={copyTranscript} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CopyIcon size={14} color="currentColor" /> Copy
                      </button>
                    </>
                  ) : (
                    <>
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
                  <h3 style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <ClockIcon size={18} color="#FF8000" /> Timestamped Segments
                  </h3>
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
                <button className="btn btn-primary" onClick={() => setShowExport(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <DownloadIcon size={16} color="#0a0a0a" /> Export Transcript
                </button>
                <button className="btn btn-outline" onClick={() => {
                  router.push(`/translate?text=${encodeURIComponent(transcript.substring(0, 2000))}`);
                }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <GlobeIcon size={16} color="currentColor" /> Translate
                </button>
                <button className="btn btn-outline" onClick={() => {
                  router.push(`/tts?text=${encodeURIComponent(transcript.substring(0, 500))}`);
                }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <VolumeIcon size={16} color="currentColor" /> Generate Voice
                </button>
                <button className="btn btn-ghost" onClick={handleReset} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <RefreshIcon size={16} color="currentColor" /> New Recording
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
