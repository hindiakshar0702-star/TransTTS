"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LanguageSelect, { FlagImage } from "@/components/LanguageSelect";
import { useToast } from "@/components/Toast";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import {
  GlobeIcon,
  VolumeIcon,
  SparklesIcon,
  FileTextIcon,
  RefreshIcon,
  RepeatIcon,
  AlertCircleIcon,
  CopyIcon,
  TrashIcon,
  ArrowRightIcon,
  CheckCircleIcon
} from "@/components/Icons";

export default function TranslatePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <TranslateContent />
    </Suspense>
  );
}

const QUICK_SOURCE_PILLS = [
  { code: "auto", label: "Auto Detect", flagCode: "un" },
  { code: "en", label: "English", flagCode: "us" },
  { code: "hi", label: "Hindi", flagCode: "in" },
  { code: "es", label: "Spanish", flagCode: "es" },
  { code: "fr", label: "French", flagCode: "fr" },
];

const QUICK_TARGET_PILLS = [
  { code: "hi", label: "Hindi", flagCode: "in" },
  { code: "en", label: "English", flagCode: "us" },
  { code: "mr", label: "Marathi", flagCode: "in" },
  { code: "bn", label: "Bengali", flagCode: "bd" },
  { code: "gu", label: "Gujarati", flagCode: "in" },
];


function TranslateContent() {
  const [isAuth, setIsAuth] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [sourceText, setSourceText] = usePersistedState("translate_source", "");
  const [translatedText, setTranslatedText] = usePersistedState("translate_result", "");
  /**
   * The translation rewritten in Devanagari, so a result in Bengali, Telugu,
   * Urdu, Japanese or anything else can be read aloud without knowing that
   * script. Empty when the target is already Devanagari, or when the
   * best-effort transliteration failed.
   */
  const [pronunciation, setPronunciation] = usePersistedState("translate_pronunciation", "");
  const [sourceLang, setSourceLang] = usePersistedState("translate_srcLang", "auto");
  const [targetLang, setTargetLang] = usePersistedState("translate_tgtLang", "hi");
  const [status, setStatus] = usePersistedState<"idle" | "translating" | "done" | "error">("translate_status", "idle");
  const [error, setError] = useState("");
  const [engine, setEngine] = usePersistedState("translate_engine", "");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    const text = searchParams.get("text");
    if (text) {
      setSourceText(text);
      setStatus("idle");
    }
  }, [searchParams, setSourceText, setStatus]);

  if (!isAuth) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  const handleReset = () => {
    clearPersistedState("translate_");
    setSourceText("");
    setTranslatedText("");
    setPronunciation("");
    setSourceLang("auto");
    setTargetLang("hi");
    setStatus("idle");
    setError("");
    setEngine("");
    showToast("Translation board cleared", "info");
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setStatus("translating");
    setError("");
    setTranslatedText("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, sourceLang, targetLang }),
      });

      if (!res.ok) {
        let errorMsg = "Translation failed";
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorMsg = data.error || errorMsg;
          } catch {
            errorMsg = `Server error: ${res.status} ${res.statusText}`;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setTranslatedText(data.translatedText);
      setPronunciation(data.pronunciation || "");
      setEngine(data.engine);
      setStatus("done");

      addToHistory({
        type: "translate",
        title: sourceText.substring(0, 60) + (sourceText.length > 60 ? "..." : ""),
        status: "completed",
        data: {
          sourceText: sourceText.substring(0, 500),
          translatedText: data.translatedText.substring(0, 500),
          sourceLang,
          targetLang,
          engine: data.engine,
        },
      });
      showToast("Translation complete!", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Translation failed");
      setStatus("error");
      showToast("Translation failed", "error");
    }
  };

  const swapLanguages = () => {
    if (sourceLang === "auto") {
      showToast("Cannot swap when Source is Auto Detect", "info");
      return;
    }
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
    showToast("Languages & text swapped", "success");
  };

  const copyTranslation = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    showToast("Translation copied!", "success");
  };

  const speakText = (text: string, lang: string) => {
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "auto" ? "en" : lang;
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    showToast("Playing speech...", "info");
  };

  const sampleTexts = [
    "Welcome to TransTTS! Speak, record, transcribe, and translate audio effortlessly.",
    "नमस्ते! ट्रान्स-टीटीएस में आपका स्वागत है। अपनी आवाज़ को रिकॉर्ड और अनुवाद करें।",
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar active="translate" />
      <div className="dashboard-content-wrapper">
        {/* Header Title */}
        <div className="app-header fade-in" style={{ marginBottom: "24px", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ fontSize: "2.2rem", display: "flex", alignItems: "center", gap: "12px" }}>
                <GlobeIcon size={32} color="var(--accent)" />
                <span className="gradient-text">AI Translation Studio</span>
              </h1>
              <p style={{ marginTop: "4px", color: "var(--text-dim)", fontSize: "0.95rem" }}>
                Seamless multi-language AI translation with instant playback and voice generation
              </p>
            </div>
            
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleReset}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)" }}
            >
              <RefreshIcon size={14} color="currentColor" /> Reset Board
            </button>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div className="badge badge-error fade-in" style={{ padding: "14px 20px", fontSize: "0.9rem", marginBottom: "20px", display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
            <AlertCircleIcon size={18} color="currentColor" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Control Bar: Custom Language Selection with Flags */}
        <div className="glass-card fade-in" style={{ padding: "20px 24px", marginBottom: "24px" }}>
          <div className="translate-toolbar-grid">
            
            {/* Source Language Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <LanguageSelect
                label="SOURCE LANGUAGE"
                value={sourceLang}
                onChange={(code) => setSourceLang(code)}
                allowAuto={true}
              />
              
              {/* Quick Pills with Flags */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {QUICK_SOURCE_PILLS.map((pill) => (
                  <button
                    key={pill.code}
                    type="button"
                    onClick={() => setSourceLang(pill.code)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      border: sourceLang === pill.code ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: sourceLang === pill.code ? "rgba(255,128,0,0.12)" : "var(--glass2)",
                      color: sourceLang === pill.code ? "var(--accent)" : "var(--text)",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <FlagImage flagCode={pill.flagCode} name={pill.label} size={18} />
                    <span>{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Swap Button Column */}
            <div className="translate-swap-container">
              <button
                type="button"
                className="btn btn-outline swap-btn"
                onClick={swapLanguages}
                title="Swap source and target languages"
                disabled={sourceLang === "auto"}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                }}
              >
                <RepeatIcon size={18} color="currentColor" />
              </button>
            </div>

            {/* Target Language Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <LanguageSelect
                label="TARGET LANGUAGE"
                value={targetLang}
                onChange={(code) => setTargetLang(code)}
                allowAuto={false}
              />

              {/* Quick Pills with Flags */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {QUICK_TARGET_PILLS.map((pill) => (
                  <button
                    key={pill.code}
                    type="button"
                    onClick={() => setTargetLang(pill.code)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      border: targetLang === pill.code ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: targetLang === pill.code ? "rgba(255,128,0,0.12)" : "var(--glass2)",
                      color: targetLang === pill.code ? "var(--accent)" : "var(--text)",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <FlagImage flagCode={pill.flagCode} name={pill.label} size={18} />
                    <span>{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Dual Panels: Studio Grid Layout */}
        <div className="translate-studio-grid fade-in">

          {/* LEFT PANEL: Source Text */}
          <div className="glass-card studio-card">
            <div className="studio-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="studio-icon-badge">
                  <FileTextIcon size={18} color="var(--accent)" />
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Source Text</h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {sourceText && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setSourceText(""); setStatus("idle"); }}
                    title="Clear input text"
                    style={{ padding: "6px 12px" }}
                  >
                    <TrashIcon size={14} color="currentColor" /> Clear
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => speakText(sourceText, sourceLang)}
                  disabled={!sourceText.trim()}
                  title="Listen to original text"
                  style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <VolumeIcon size={14} color="currentColor" /> Speak
                </button>
              </div>
            </div>

            <div className="studio-card-body">
              <textarea
                className="textarea-input studio-textarea"
                placeholder="Type or paste your text to translate..."
                value={sourceText}
                onChange={(e) => { setSourceText(e.target.value); setStatus("idle"); }}
              />

              {!sourceText.trim() && (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Try sample text:</span>
                  {sampleTexts.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setSourceText(sample); setStatus("idle"); }}
                      style={{ fontSize: "0.76rem", padding: "4px 10px", border: "1px solid var(--border)", background: "var(--glass2)" }}
                    >
                      Sample {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="studio-card-footer">
              <div className="char-count" style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-dim)" }}>
                {sourceText.length.toLocaleString()} / 10,000 characters
              </div>

              <button
                className="btn btn-primary"
                onClick={handleTranslate}
                disabled={!sourceText.trim() || status === "translating"}
                style={{ minWidth: "160px", height: "44px" }}
              >
                {status === "translating" ? (
                  <><span className="spinner"></span> Translating...</>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <GlobeIcon size={18} color="#0a0a0a" />
                    <span>Translate Now</span>
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Translation Output */}
          <div className="glass-card studio-card">
            <div className="studio-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="studio-icon-badge" style={{ background: "rgba(255,128,0,0.1)" }}>
                  <SparklesIcon size={18} color="var(--accent)" />
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>Translation Output</span>
                  {engine && (
                    <span className="badge badge-info" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                      {engine}
                    </span>
                  )}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => speakText(translatedText, targetLang)}
                  disabled={!translatedText.trim()}
                  title="Listen to translation"
                  style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <VolumeIcon size={14} color="currentColor" /> Speak
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={copyTranslation}
                  disabled={!translatedText.trim()}
                  title="Copy translation"
                  style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <CopyIcon size={14} color="currentColor" /> Copy
                </button>
              </div>
            </div>

            <div className="studio-card-body">
              <textarea
                className="textarea-input studio-textarea studio-output-textarea"
                placeholder="Translation will appear here instantly..."
                value={translatedText}
                readOnly
              />

              {pronunciation && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--glass2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Pronunciation (Devanagari)
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px" }}
                      onClick={() => {
                        navigator.clipboard.writeText(pronunciation);
                        showToast("Pronunciation copied!", "success");
                      }}
                    >
                      <CopyIcon size={12} color="currentColor" /> Copy
                    </button>
                  </div>
                  <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--text)" }}>{pronunciation}</div>
                </div>
              )}
            </div>

            <div className="studio-card-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {status === "done" && (
                  <span style={{ fontSize: "0.8rem", color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <CheckCircleIcon size={14} color="var(--success)" /> Translated successfully
                  </span>
                )}
              </div>

              {translatedText && (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, height: "42px", padding: "0 18px" }}
                  onClick={() => {
                    router.push(`/tts?text=${encodeURIComponent(translatedText.substring(0, 500))}`);
                  }}
                >
                  <VolumeIcon size={16} color="var(--accent)" />
                  <span>Generate Voice (TTS)</span>
                  <ArrowRightIcon size={14} color="currentColor" />
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
