"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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
  const [isAuth, setIsAuth] = useState(false);
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

  // Auth Guard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      if (!loggedIn) {
        showToast("Please sign in to access this tool.", "error");
        router.push("/login?redirect=/translate");
      } else {
        setIsAuth(true);
      }
    }
  }, [router]);

  useEffect(() => {
    const text = searchParams.get("text");
    if (text) { setSourceText(text); setStatus("idle"); }
  }, [searchParams]);

  if (!isAuth) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

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
    <div className="dashboard-layout">
      <Sidebar active="translate" />
      <div className="dashboard-content-wrapper">
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "32px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.4rem", display: "flex", alignItems: "center", gap: "12px" }}>
            🌐 <span className="gradient-text">AI Translation Board</span>
          </h1>
          <p>Translate text to Hindi and 25+ languages in a modular grid</p>
        </div>

          {/* Modular Grid Layout */}
          <div className="teleprompter-grid fade-in" style={{ gridTemplateColumns: "0.7fr 1.3fr", gap: "24px", height: "auto" }}>
            
            {/* LEFT COLUMN: Settings & Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Language selection card */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>⚙️ Translation Settings</h3>
                
                <div className="form-group">
                  <label className="form-label">Source Language</label>
                  <select className="select-input" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                    <option value="auto">🌐 Auto Detect</option>
                    {langEntries.map(([code, lang]) => (
                      <option key={code} value={code}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={swapLanguages} title="Swap languages">
                    🔄 Swap Direction
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Target Language</label>
                  <select className="select-input" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                    {langEntries.map(([code, lang]) => (
                      <option key={code} value={code}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Action Buttons card */}
              <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleTranslate}
                  disabled={!sourceText.trim() || status === "translating"}
                  style={{ width: "100%" }}
                >
                  {status === "translating" ? (
                    <><span className="spinner"></span> Translating...</>
                  ) : (
                    "🌐 Translate Now"
                  )}
                </button>

                {translatedText && (
                  <button className="btn btn-outline btn-sm" style={{ width: "100%" }} onClick={() => {
                    router.push(`/tts?text=${encodeURIComponent(translatedText.substring(0, 500))}`);
                  }}>
                    🔊 Generate Voice
                  </button>
                )}

                <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={handleReset}>
                  🔄 Reset Panel
                </button>
              </div>

              {error && (
                <div className="badge badge-error fade-in" style={{ padding: "12px 18px", fontSize: "0.85rem", display: "block" }}>
                  ❌ {error}
                </div>
              )}

            </div>

            {/* RIGHT COLUMN: Panels Grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Source Text Panel */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>📝 Source Text</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => speakText(sourceText, sourceLang)} disabled={!sourceText}>
                    🔊 Speak
                  </button>
                </div>
                <textarea
                  className="textarea-input"
                  placeholder="Type or paste text to translate..."
                  value={sourceText}
                  onChange={(e) => { setSourceText(e.target.value); setStatus("idle"); }}
                  style={{ minHeight: "160px", resize: "vertical" }}
                />
                <div className="char-count" style={{ marginTop: "8px" }}>{sourceText.length} / 10,000 characters</div>
              </div>

              {/* Translation Output Panel */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    ✨ Translation Output
                    {engine && <span className="badge badge-info">{engine}</span>}
                  </h3>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => speakText(translatedText, targetLang)} disabled={!translatedText}>
                      🔊 Speak
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={copyTranslation} disabled={!translatedText}>
                      📋 Copy
                    </button>
                  </div>
                </div>
                <textarea
                  className="textarea-input"
                  placeholder="Translation will appear here..."
                  value={translatedText}
                  readOnly
                  style={{ minHeight: "160px", resize: "vertical", background: "rgba(0,0,0,0.15)" }}
                />
              </div>

            </div>

          </div>

      </div>
    </div>
  );
}
