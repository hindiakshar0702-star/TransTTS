"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ToolNav from "@/components/ToolNav";
import { useToast } from "@/components/Toast";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { addToHistory } from "@/lib/history";
import { LANGUAGES } from "@/lib/utils";

export default function TranslatePage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"var(--bg)"}} />}>
      <TranslateContent />
    </Suspense>
  );
}

function TranslateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [sourceText, setSourceText] = usePersistedState("translate_source", "");
  const [translatedText, setTranslatedText] = usePersistedState("translate_result", "");
  const [sourceLang, setSourceLang] = usePersistedState("translate_srcLang", "auto");
  const [targetLang, setTargetLang] = usePersistedState("translate_tgtLang", "hi");
  const [status, setStatus] = usePersistedState<"idle" | "translating" | "done" | "error">("translate_status", "idle");
  const [error, setError] = useState("");
  const [engine, setEngine] = usePersistedState("translate_engine", "");

  useEffect(() => {
    const text = searchParams.get("text");
    if (text) { setSourceText(text); setStatus("idle"); }
  }, [searchParams]);

  const handleReset = () => {
    clearPersistedState("translate_");
    setSourceText(""); setTranslatedText(""); setSourceLang("auto");
    setTargetLang("hi"); setStatus("idle"); setError(""); setEngine("");
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
          } catch (e) {
            errorMsg = `Server error: ${res.status} ${res.statusText}`;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setTranslatedText(data.translatedText);
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
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const copyTranslation = () => {
    navigator.clipboard.writeText(translatedText);
    showToast("Translation copied!", "success");
  };

  const speakText = (text: string, lang: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "auto" ? "en" : lang;
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const langEntries = Object.entries(LANGUAGES).filter(([code]) => code !== "auto");

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container">
          <div className="app-header fade-in">
            <h1>🌐 <span className="gradient-text">AI Translation</span></h1>
            <p>Translate text to Hindi and 25+ languages powered by GPT-4o</p>
          </div>

          <ToolNav />

          {/* Language selectors */}
          <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label className="form-label">Source Language</label>
              <select className="select-input" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                <option value="auto">🌐 Auto Detect</option>
                {langEntries.map(([code, lang]) => (
                  <option key={code} value={code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>

            <button className="btn btn-ghost" onClick={swapLanguages}
              style={{ marginTop: 24, fontSize: "1.2rem" }} title="Swap languages">
              ⇄
            </button>

            <div style={{ flex: 1, minWidth: 150 }}>
              <label className="form-label">Target Language</label>
              <select className="select-input" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                {langEntries.map(([code, lang]) => (
                  <option key={code} value={code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Translation panels */}
          <div className="translate-grid fade-in">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Source Text</label>
                <button className="btn btn-ghost btn-sm" onClick={() => speakText(sourceText, sourceLang)}
                  disabled={!sourceText}>🔊 Speak</button>
              </div>
              <textarea
                className="textarea-input"
                placeholder="Type or paste text to translate..."
                value={sourceText}
                onChange={(e) => { setSourceText(e.target.value); setStatus("idle"); }}
                style={{ minHeight: 250 }}
              />
              <div className="char-count">{sourceText.length} / 10,000 characters</div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Translation {engine && <span className="badge badge-info" style={{ marginLeft: 8 }}>{engine}</span>}
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => speakText(translatedText, targetLang)}
                    disabled={!translatedText}>🔊 Speak</button>
                  <button className="btn btn-ghost btn-sm" onClick={copyTranslation}
                    disabled={!translatedText}>📋 Copy</button>
                </div>
              </div>
              <textarea
                className="textarea-input"
                placeholder="Translation will appear here..."
                value={translatedText}
                readOnly
                style={{ minHeight: 250, background: "var(--bg-card)" }}
              />
            </div>
          </div>

          {error && (
            <div className="badge badge-error" style={{ padding: "12px 18px", fontSize: "0.9rem", marginTop: 12 }}>
              ❌ {error}
            </div>
          )}

          <div className="action-bar" style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary btn-large"
              onClick={handleTranslate}
              disabled={!sourceText.trim() || status === "translating"}
              style={{ flex: 1, maxWidth: 300 }}
            >
              {status === "translating" ? (
                <><span className="spinner"></span> Translating...</>
              ) : (
                "🌐 Translate"
              )}
            </button>
            {translatedText && (
              <button className="btn btn-outline" onClick={() => {
                router.push(`/tts?text=${encodeURIComponent(translatedText.substring(0, 500))}`);
              }}>
                🔊 Generate Voice from Translation
              </button>
            )}
            <button className="btn btn-ghost" onClick={handleReset}>
              🔄 Reset
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
