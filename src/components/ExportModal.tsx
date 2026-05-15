"use client";
import { useState } from "react";
import type { TranscriptSegment } from "@/types";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
  segments: TranscriptSegment[];
  fileName?: string;
}

function formatSrtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatVttTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

const FORMATS = [
  { id: "txt", name: "Plain Text", icon: "📄", ext: ".txt", desc: "Simple text file" },
  { id: "srt", name: "SRT Subtitles", icon: "🎬", ext: ".srt", desc: "SubRip format for video players" },
  { id: "vtt", name: "WebVTT", icon: "🌐", ext: ".vtt", desc: "Web Video Text Tracks" },
  { id: "json", name: "JSON", icon: "📊", ext: ".json", desc: "Structured data with timestamps" },
];

export default function ExportModal({ isOpen, onClose, transcript, segments, fileName }: ExportModalProps) {
  const [selected, setSelected] = useState("txt");

  if (!isOpen) return null;

  const baseName = fileName?.replace(/\.[^.]+$/, "") || `transcript-${Date.now()}`;

  const generateContent = (format: string): string => {
    switch (format) {
      case "txt":
        return transcript;

      case "srt":
        return segments.map((seg, i) => {
          const start = formatSrtTime(seg.start);
          const end = formatSrtTime(seg.end);
          return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
        }).join("\n");

      case "vtt":
        return "WEBVTT\n\n" + segments.map((seg) => {
          const start = formatVttTime(seg.start);
          const end = formatVttTime(seg.end);
          return `${start} --> ${end}\n${seg.text}\n`;
        }).join("\n");

      case "json":
        return JSON.stringify({
          transcript,
          segments: segments.map((seg) => ({
            id: seg.id,
            start: seg.start,
            end: seg.end,
            text: seg.text,
          })),
          exportedAt: new Date().toISOString(),
        }, null, 2);

      default:
        return transcript;
    }
  };

  const handleDownload = () => {
    const fmt = FORMATS.find((f) => f.id === selected)!;
    const content = generateContent(selected);
    const mimeType = selected === "json" ? "application/json" : "text/plain";
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const preview = generateContent(selected).substring(0, 500);

  return (
    <>
      <div className="mobile-overlay" onClick={onClose} />
      <div className="export-modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2>📥 Export Transcript</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="export-formats">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              className={`export-format-btn ${selected === fmt.id ? "active" : ""}`}
              onClick={() => setSelected(fmt.id)}
              disabled={fmt.id !== "txt" && segments.length === 0}
            >
              <span style={{ fontSize: "1.3rem" }}>{fmt.icon}</span>
              <span className="export-format-name">{fmt.name}</span>
              <span className="export-format-desc">{fmt.desc}</span>
              {fmt.id !== "txt" && segments.length === 0 && (
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>No timestamps</span>
              )}
            </button>
          ))}
        </div>

        <div className="export-preview">
          <h4 style={{ marginBottom: 8, color: "var(--text-dim)" }}>Preview</h4>
          <pre className="export-preview-code">{preview}{preview.length >= 500 ? "\n..." : ""}</pre>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleDownload}>
            📥 Download {FORMATS.find((f) => f.id === selected)?.ext}
          </button>
        </div>
      </div>
    </>
  );
}
