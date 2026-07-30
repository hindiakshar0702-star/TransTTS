"use client";
import React, { useState, useRef, useEffect } from "react";
import { LANGUAGES } from "@/lib/utils";
import { CheckCircleIcon, GlobeIcon, SearchIcon } from "@/components/Icons";

interface LanguageSelectProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  allowAuto?: boolean;
}

export function CountrySvgFlag({ code, size = 28 }: { code: string; size?: number }) {
  const width = size;
  const height = Math.round(size * 0.7);

  switch (code.toLowerCase()) {
    case "in":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#f93" d="M0 0h640v160H0z"/>
          <path fill="#fff" d="M0 160h640v160H0z"/>
          <path fill="#128807" d="M0 320h640v160H0z"/>
          <circle cx="320" cy="240" r="50" fill="none" stroke="#000080" strokeWidth="10"/>
        </svg>
      );
    case "us":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#bd3d44" d="M0 0h640v480H0z"/>
          <path stroke="#fff" strokeWidth="37" d="M0 55.5h640M0 129.5h640M0 203.5h640M0 277.5h640M0 351.5h640M0 425.5h640"/>
          <path fill="#192f5d" d="M0 0h280v258.5H0z"/>
        </svg>
      );
    case "es":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#c60b1e" d="M0 0h640v480H0z"/>
          <path fill="#ffc400" d="M0 120h640v240H0z"/>
        </svg>
      );
    case "fr":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#051440" d="M0 0h213.3v480H0z"/>
          <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
          <path fill="#ec1920" d="M426.7 0H640v480H426.7z"/>
        </svg>
      );
    case "de":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#000" d="M0 0h640v160H0z"/>
          <path fill="#dd0000" d="M0 160h640v160H0z"/>
          <path fill="#ffce00" d="M0 320h640v160H0z"/>
        </svg>
      );
    case "ja": case "jp":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <path fill="#fff" d="M0 0h640v480H0z"/>
          <circle cx="320" cy="240" r="140" fill="#bc002d"/>
        </svg>
      );
    case "zh": case "cn":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#ee1c25" d="M0 0h640v480H0z"/>
          <circle cx="120" cy="120" r="36" fill="#ffde00"/>
        </svg>
      );
    case "ar": case "sa":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#007a3d" d="M0 0h640v480H0z"/>
          <path fill="#fff" d="M160 220h320v40H160z"/>
        </svg>
      );
    case "br": case "pt":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#009b3a" d="M0 0h640v480H0z"/>
          <path fill="#fedf00" d="M320 60L580 240L320 420L60 240Z"/>
          <circle cx="320" cy="240" r="100" fill="#002776"/>
        </svg>
      );
    case "kr": case "ko":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <path fill="#fff" d="M0 0h640v480H0z"/>
          <circle cx="320" cy="240" r="120" fill="#c60c30"/>
        </svg>
      );
    case "it":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#009246" d="M0 0h213.3v480H0z"/>
          <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
          <path fill="#ce2b37" d="M426.7 0H640v480H426.7z"/>
        </svg>
      );
    case "ru":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <path fill="#fff" d="M0 0h640v160H0z"/>
          <path fill="#0039a6" d="M0 160h640v160H0z"/>
          <path fill="#d52b1e" d="M0 320h640v160H0z"/>
        </svg>
      );
    case "tr":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#e30a17" d="M0 0h640v480H0z"/>
          <circle cx="260" cy="240" r="120" fill="#fff"/>
          <circle cx="290" cy="240" r="96" fill="#e30a17"/>
        </svg>
      );
    case "nl":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#ae1c28" d="M0 0h640v160H0z"/>
          <path fill="#fff" d="M0 160h640v160H0z"/>
          <path fill="#21468b" d="M0 320h640v160H0z"/>
        </svg>
      );
    case "pl":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <path fill="#fff" d="M0 0h640v240H0z"/>
          <path fill="#dc143c" d="M0 240h640v240H0z"/>
        </svg>
      );
    case "se": case "sv":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#006aa7" d="M0 0h640v480H0z"/>
          <path fill="#fecc00" d="M180 0h80v480h-80zM0 200h640v80H0z"/>
        </svg>
      );
    case "th":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#a51931" d="M0 0h640v480H0z"/>
          <path fill="#f4f5f8" d="M0 80h640v320H0z"/>
          <path fill="#2d2a4a" d="M0 160h640v160H0z"/>
        </svg>
      );
    case "vn": case "vi":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#da251d" d="M0 0h640v480H0z"/>
          <polygon fill="#ff0" points="320,120 355,225 465,225 376,290 410,395 320,330 230,395 264,290 175,225 285,225"/>
        </svg>
      );
    case "id":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <path fill="#e70011" d="M0 0h640v240H0z"/>
          <path fill="#fff" d="M0 240h640v240H0z"/>
        </svg>
      );
    case "bd": case "bn":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#006a4e" d="M0 0h640v480H0z"/>
          <circle cx="280" cy="240" r="160" fill="#f42a41"/>
        </svg>
      );
    case "pk": case "ur":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#00401a" d="M0 0h640v480H0z"/>
          <path fill="#fff" d="M0 0h160v480H0z"/>
          <circle cx="360" cy="240" r="110" fill="#fff"/>
          <circle cx="390" cy="225" r="95" fill="#00401a"/>
        </svg>
      );
    case "gb":
      return (
        <svg width={width} height={height} viewBox="0 0 640 480" style={{ borderRadius: "3px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
          <path fill="#012169" d="M0 0h640v480H0z"/>
          <path stroke="#fff" strokeWidth="60" d="m0 0 640 480M0 480 640 0M320 0v480M0 240h640"/>
          <path stroke="#c8102e" strokeWidth="40" d="M320 0v480M0 240h640"/>
        </svg>
      );
    default:
      return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: Math.round(size * 0.7) }}>
          <GlobeIcon size={Math.round(size * 0.75)} color="var(--accent)" />
        </span>
      );
  }
}

export function FlagImage({ flagCode, name, size = 20 }: { flagCode?: string; name: string; size?: number }) {
  if (!flagCode || flagCode === "un") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: Math.round(size * 0.7) }}>
        <GlobeIcon size={Math.round(size * 0.75)} color="var(--accent)" />
      </span>
    );
  }
  return <CountrySvgFlag code={flagCode} size={size} />;
}

export default function LanguageSelect({
  value,
  onChange,
  label,
  allowAuto = true,
}: LanguageSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLang = LANGUAGES[value] || { name: value, flagCode: "un", code: value };

  const allLangs = Object.entries(LANGUAGES)
    .filter(([code]) => allowAuto || code !== "auto")
    .map(([code, data]) => ({ ...data, code }));

  const filteredLangs = allLangs.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="custom-lang-select-container" ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {label && (
        <label className="form-label" style={{ marginBottom: "6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
          {label}
        </label>
      )}

      {/* Trigger Button: Left Avatar, Middle Larger Name, Right Larger Flag + Arrow */}
      <button
        type="button"
        className="select-input custom-lang-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 18px",
          background: "#ffffff",
          border: isOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
          boxShadow: isOpen ? "0 0 0 3px var(--accent-glow)" : "0 2px 8px rgba(0,0,0,0.03)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.2s ease"
        }}
      >
        {/* LEFT: Circle Avatar Badge & MIDDLE: Larger Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 128, 0, 0.12)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.95rem",
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <GlobeIcon size={18} color="var(--accent)" />
          </div>

          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", letterSpacing: "-0.01em" }}>
            {selectedLang.name}
          </span>
        </div>

        {/* RIGHT: Flag + Dropdown Arrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FlagImage flagCode={selectedLang.flagCode} name={selectedLang.name} size={22} />

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "var(--text-dim)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="glass-card custom-lang-dropdown fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 999,
            padding: "12px",
            maxHeight: "320px",
            overflowY: "auto",
            boxShadow: "0 12px 36px rgba(0,0,0,0.16)",
            background: "#ffffff",
            border: "1px solid var(--border2)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {/* Search Box with Lucide SearchIcon */}
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", color: "var(--text-dim)", pointerEvents: "none" }}>
              <SearchIcon size={16} color="currentColor" />
            </div>
            <input
              type="text"
              className="text-input"
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                padding: "8px 12px 8px 36px",
                fontSize: "0.88rem",
                borderRadius: "var(--radius-xs)",
                width: "100%"
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {filteredLangs.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", fontSize: "0.85rem", color: "var(--text-dim)" }}>
                No languages found
              </div>
            ) : (
              filteredLangs.map((item) => {
                const isSelected = item.code === value;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      onChange(item.code);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: isSelected ? "rgba(255, 128, 0, 0.12)" : "transparent",
                      color: isSelected ? "var(--accent)" : "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    className="lang-option-item"
                  >
                    {/* LEFT: Circle Avatar Badge & MIDDLE: Larger Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: isSelected ? "var(--accent)" : "rgba(0,0,0,0.05)",
                          color: isSelected ? "#ffffff" : "var(--text-dim)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {item.code === "auto" ? (
                          <GlobeIcon size={16} color="currentColor" />
                        ) : (
                          item.name.substring(0, 1).toUpperCase()
                        )}
                      </div>

                      <span style={{ fontWeight: isSelected ? 800 : 600, fontSize: "0.98rem", color: "var(--text)" }}>
                        {item.name}
                      </span>
                    </div>

                    {/* RIGHT: Larger Flag + Selected Check */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FlagImage flagCode={item.flagCode} name={item.name} size={20} />
                      {isSelected && <CheckCircleIcon size={16} color="var(--accent)" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
