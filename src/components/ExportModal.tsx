"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ExportModal({
  isOpen,
  onClose,
  transcript,
  segments,
  fileName,
}: ExportModalProps) {
  const [selected, setSelected] = useState("txt");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  /**
   * A11y plumbing for the dialog:
   *   - ESC closes
   *   - focus is trapped between the first/last focusable elements
   *   - body scroll is locked while open
   *   - the previously-focused element is restored on close
   *
   * Implemented from scratch (no Radix / Headless UI) to keep the
   * bundle small. Built-in <dialog>.showModal() would be even
   * better but doesn't yet support backdrop styling consistently.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    const root = dialogRef.current;
    if (root) {
      const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const baseName = fileName?.replace(/\.[^.]+$/, "") || `transcript-${Date.now()}`;

  const generateContent = (format: string): string => {
    switch (format) {
      case "txt":
        return transcript;
      case "srt":
        return segments
          .map((seg, i) => {
            const start = formatSrtTime(seg.start);
            const end = formatSrtTime(seg.end);
            return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
          })
          .join("\n");
      case "vtt":
        return (
          "WEBVTT\n\n" +
          segments
            .map((seg) => {
              const start = formatVttTime(seg.start);
              const end = formatVttTime(seg.end);
              return `${start} --> ${end}\n${seg.text}\n`;
            })
            .join("\n")
        );
      case "json":
        return JSON.stringify(
          {
            transcript,
            segments: segments.map((seg) => ({
              id: seg.id,
              start: seg.start,
              end: seg.end,
              text: seg.text,
            })),
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        );
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
      <div
        className="mobile-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 id="export-modal-title">📥 Export Transcript</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            ✕
          </button>
        </div>

        <div className="export-formats" role="radiogroup" aria-label="Export format">
          {FORMATS.map((fmt) => {
            const isDisabled = fmt.id !== "txt" && segments.length === 0;
            const isSelected = selected === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`export-format-btn ${isSelected ? "active" : ""}`}
                onClick={() => setSelected(fmt.id)}
                disabled={isDisabled}
              >
                <span style={{ fontSize: "1.3rem" }} aria-hidden="true">
                  {fmt.icon}
                </span>
                <span className="export-format-name">{fmt.name}</span>
                <span className="export-format-desc">{fmt.desc}</span>
                {isDisabled && (
                  <span
                    style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                  >
                    No timestamps
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="export-preview">
          <h4 style={{ marginBottom: 8, color: "var(--text-dim)" }}>Preview</h4>
          <pre className="export-preview-code">
            {preview}
            {preview.length >= 500 ? "\n..." : ""}
          </pre>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleDownload}>
            📥 Download {FORMATS.find((f) => f.id === selected)?.ext}
          </button>
        </div>
      </div>
    </>
  );
}
