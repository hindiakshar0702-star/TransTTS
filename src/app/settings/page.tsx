"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useToast } from "@/components/Toast";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import {
  SettingsIcon, VolumeIcon, ShieldIcon,
  SaveIcon, RefreshIcon, TrashIcon, LockIcon
} from "@/components/Icons";

export default function SettingsPage() {
  const [isAuth, setIsAuth] = useState(false);
  const { showToast } = useToast();

  // Settings State
  const [defaultVoice, setDefaultVoice] = usePersistedState("settings_default_voice", "hi-female");
  const [defaultSpeed, setDefaultSpeed] = usePersistedState("settings_default_speed", 1.0);
  const [autoDetectLang, setAutoDetectLang] = usePersistedState("settings_auto_detect", true);
  const [autoSaveHistory, setAutoSaveHistory] = usePersistedState("settings_auto_save", true);
  const [apiKey, setApiKey] = usePersistedState("settings_api_key", "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [themeMode, setThemeMode] = usePersistedState("settings_theme", "light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
    }
  }, []);

  if (!isAuth) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  const handleSaveSettings = () => {
    showToast("Settings saved successfully!", "success");
  };

  const handleResetSettings = () => {
    setDefaultVoice("hi-female");
    setDefaultSpeed(1.0);
    setAutoDetectLang(true);
    setAutoSaveHistory(true);
    setApiKey("");
    setThemeMode("light");
    showToast("Settings reset to defaults.", "info");
  };

  const handleClearAllData = () => {
    if (confirm("Are you sure you want to clear all history and cached settings?")) {
      clearPersistedState("");
      localStorage.clear();
      showToast("All cached data & history cleared.", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar active="settings" />
      <div className="dashboard-content-wrapper">

        {/* Page Header */}
        <div className="app-header fade-in" style={{ padding: 0, marginBottom: "28px", textAlign: "left" }}>
          <h1 style={{ fontSize: "2.3rem", display: "flex", alignItems: "center", gap: "12px" }}>
            <SettingsIcon size={32} color="#FF8000" /> <span className="gradient-text">System Settings</span>
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
            Configure app preferences, AI speech defaults, API configurations &amp; data privacy
          </p>
        </div>

        {/* Settings Container Grid */}
        <div className="fade-in" style={{ maxWidth: "840px", display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Section 1: AI Speech & Voice Defaults */}
          <div className="glass-card" style={{ padding: "26px", borderRadius: "18px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: 10 }}>
              <VolumeIcon size={20} color="#FF8000" />
              <span>AI Speech &amp; Voice Defaults</span>
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

              {/* Default Voice */}
              <div>
                <label className="form-label" style={{ marginBottom: "6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                  Default Neural Voice
                </label>
                <select
                  className="select-input"
                  value={defaultVoice}
                  onChange={(e) => setDefaultVoice(e.target.value)}
                  style={{ height: "42px", fontSize: "0.88rem", borderRadius: "10px" }}
                >
                  <option value="hi-female">Swara (Hindi Female)</option>
                  <option value="hi-male">Madhur (Hindi Male)</option>
                  <option value="en-female">Jenny (English Female)</option>
                  <option value="en-male">Guy (English Male)</option>
                  <option value="en-uk-female">Sonia (British Female)</option>
                  <option value="es-female">Elvira (Spanish Female)</option>
                  <option value="fr-female">Denise (French Female)</option>
                  <option value="de-female">Katja (German Female)</option>
                </select>
              </div>

              {/* Default Speed */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label className="form-label" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", margin: 0 }}>
                    Default Speech Speed
                  </label>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FF8000" }}>{defaultSpeed}x</span>
                </div>
                <input
                  type="range"
                  className="speed-slider"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={defaultSpeed}
                  onChange={(e) => setDefaultSpeed(parseFloat(e.target.value))}
                  style={{ width: "100%", marginTop: "8px", accentColor: "#FF8000" }}
                />
              </div>

            </div>

            {/* Auto Detect Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px", paddingTop: "16px", borderTop: "1px dashed var(--border)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>Auto-Detect Audio Language</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Automatically identify spoken language in Whisper AI transcriptions</div>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoDetectLang}
                  onChange={(e) => setAutoDetectLang(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: autoDetectLang ? "#FF8000" : "#ccc",
                  transition: ".3s", borderRadius: "34px"
                }}>
                  <span style={{
                    position: "absolute", content: '""', height: "18px", width: "18px", left: "3px", bottom: "3px",
                    backgroundColor: "white", transition: ".3s", borderRadius: "50%",
                    transform: autoDetectLang ? "translateX(20px)" : "translateX(0)"
                  }} />
                </span>
              </label>
            </div>

          </div>

          {/* Section 2: API Keys & Integrations */}
          <div className="glass-card" style={{ padding: "26px", borderRadius: "18px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: 10 }}>
              <LockIcon size={20} color="#FF8000" />
              <span>Custom API Configurations</span>
            </h3>

            <div>
              <label className="form-label" style={{ marginBottom: "6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                Custom Whisper API Key (Optional)
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type={showApiKey ? "text" : "password"}
                  className="select-input"
                  placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ height: "42px", fontSize: "0.88rem", borderRadius: "10px", flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{ height: "42px", padding: "0 14px", borderRadius: "10px", fontSize: "0.8rem" }}
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "6px" }}>
                If left empty, TransTTS uses the default built-in high-speed engine endpoints.
              </div>
            </div>
          </div>

          {/* Section 3: Data Privacy & Storage */}
          <div className="glass-card" style={{ padding: "26px", borderRadius: "18px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldIcon size={20} color="#FF8000" />
              <span>Data Privacy &amp; Local Storage</span>
            </h3>

            {/* Auto Save History Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>Auto-Save Task History</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Save completed transcriptions and audio outputs to your browser history</div>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoSaveHistory}
                  onChange={(e) => setAutoSaveHistory(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: autoSaveHistory ? "#FF8000" : "#ccc",
                  transition: ".3s", borderRadius: "34px"
                }}>
                  <span style={{
                    position: "absolute", content: '""', height: "18px", width: "18px", left: "3px", bottom: "3px",
                    backgroundColor: "white", transition: ".3s", borderRadius: "50%",
                    transform: autoSaveHistory ? "translateX(20px)" : "translateX(0)"
                  }} />
                </span>
              </label>
            </div>

            {/* Clear All Data Danger Action */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "16px", borderTop: "1px dashed var(--border)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>Clear All Cached History &amp; Data</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Permanently clear local storage cache, audio history, and saved drafts</div>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleClearAllData}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "36px", borderRadius: "10px", fontSize: "0.82rem" }}
              >
                <TrashIcon size={14} color="currentColor" /> Clear Data
              </button>
            </div>

          </div>

          {/* Bottom Action CTA Bar */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleResetSettings}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "42px", borderRadius: "100px", padding: "0 18px" }}
            >
              <RefreshIcon size={14} color="currentColor" /> Reset Defaults
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveSettings}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: "42px", borderRadius: "100px", padding: "0 26px", fontWeight: 700, fontSize: "0.9rem", boxShadow: "0 4px 14px rgba(255,128,0,0.22)" }}
            >
              <SaveIcon size={16} color="#0a0a0a" /> Save Settings
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
