"use client";
import { useState, useEffect, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import LanguageSelect from "@/components/LanguageSelect";
import { useToast } from "@/components/Toast";
import { useRef } from "react";
import {
  UserIcon,
  GlobeIcon,
  VolumeIcon,
  SparklesIcon,
  CheckIcon,
  SettingsIcon,
  BarChartIcon,
  MicIcon,
  RadioIcon,
  CameraIcon,
  ShieldIcon,
  LockIcon
} from "@/components/Icons";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const [isAuth, setIsAuth] = useState(false);
  const { showToast } = useToast();

  const [userName, setUserName] = useState("Google User");
  const [userEmail, setUserEmail] = useState("googleuser@gmail.com");
  const [userAvatar, setUserAvatar] = useState("");
  const [userPhone, setUserPhone] = useState("+91 98765 43210");
  const [userRole, setUserRole] = useState("Voice Content Creator");
  const [userOrg, setUserOrg] = useState("TransTTS Studio");
  const [userBio, setUserBio] = useState("Audio & speech enthusiast using TransTTS for multilingual dubbing and transcriptions.");
  const [defaultLang, setDefaultLang] = useState("hi");
  const [defaultVoice, setDefaultVoice] = useState("hi-female");
  const [autoSave, setAutoSave] = useState(true);
  const [confirmDetails, setConfirmDetails] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuth(true);
      setUserName(localStorage.getItem("userName") || "Google User");
      setUserEmail(localStorage.getItem("userEmail") || "googleuser@gmail.com");
      setUserAvatar(localStorage.getItem("userAvatar") || "");
      setUserPhone(localStorage.getItem("userPhone") || "+91 98765 43210");
      setUserRole(localStorage.getItem("userRole") || "Voice Content Creator");
      setUserOrg(localStorage.getItem("userOrg") || "TransTTS Studio");
      setUserBio(localStorage.getItem("userBio") || "Audio & speech enthusiast using TransTTS for multilingual dubbing and transcriptions.");
      setDefaultLang(localStorage.getItem("defaultLang") || "hi");
      setDefaultVoice(localStorage.getItem("defaultVoice") || "hi-female");
    }
  }, []);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass) {
      showToast("Please enter your current password", "error");
      return;
    }
    if (newPass.length < 6) {
      showToast("New password must be at least 6 characters", "error");
      return;
    }
    if (newPass !== confirmPass) {
      showToast("New password and confirm password do not match", "error");
      return;
    }
    showToast("Password updated successfully!", "success");
    setCurrentPass("");
    setNewPass("");
    setConfirmPass("");
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      showToast("Image size must be under 5MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUserAvatar(result);
      if (typeof window !== "undefined") {
        localStorage.setItem("userAvatar", result);
        window.dispatchEvent(new Event("profileUpdated"));
        showToast("Profile photo updated!", "success");
      }
    };
    reader.readAsDataURL(f);
  };

  if (!isAuth) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("userName", userName);
      localStorage.setItem("userEmail", userEmail);
      localStorage.setItem("userPhone", userPhone);
      localStorage.setItem("userRole", userRole);
      localStorage.setItem("userOrg", userOrg);
      localStorage.setItem("userBio", userBio);
      localStorage.setItem("defaultLang", defaultLang);
      localStorage.setItem("defaultVoice", defaultVoice);
      window.dispatchEvent(new Event("profileUpdated"));
      showToast("Personal details saved successfully!", "success");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar active="profile" />
      <div className="dashboard-content-wrapper">
        
        {/* Header Title */}
        <div className="app-header fade-in" style={{ marginBottom: "28px", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "2.2rem", display: "flex", alignItems: "center", gap: "12px" }}>
                <UserIcon size={32} color="var(--accent)" />
                <span className="gradient-text">User Profile & Account Settings</span>
              </h1>
              <p style={{ marginTop: "4px", color: "var(--text-dim)", fontSize: "0.95rem" }}>
                Manage your account credentials, language preferences, and app configurations
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveProfile}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: "44px", padding: "0 22px", fontWeight: 700 }}
            >
              <CheckIcon size={18} color="#0a0a0a" />
              <span>Save Profile</span>
            </button>


          </div>
        </div>

        {/* Top Profile Summary Card */}
        <div className="glass-card fade-in" style={{ padding: "28px", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            
            {/* Avatar Circle with Camera Overlay Badge */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                onClick={() => avatarFileRef.current?.click()}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: userAvatar ? "url(" + userAvatar + ") center/cover no-repeat" : "var(--gradient)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.2rem",
                  fontWeight: 900,
                  boxShadow: "0 6px 20px rgba(255, 128, 0, 0.3)",
                  cursor: "pointer",
                  overflow: "hidden",
                  border: "2px solid #ffffff"
                }}
                title="Click to upload profile photo"
              >
                {!userAvatar && userName.substring(0, 1).toUpperCase()}
              </div>

              {/* Camera Icon Badge */}
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                style={{
                  position: "absolute",
                  bottom: "0px",
                  right: "0px",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#FF8000",
                  border: "2px solid #ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                  transition: "transform 0.2s ease"
                }}
                title="Upload Profile Photo"
              >
                <CameraIcon size={14} color="#ffffff" />
              </button>

              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: "none" }}
              />

              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "#10b981",
                  border: "2px solid #ffffff",
                }}
                title="Active Now"
              />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)" }}>{userName}</h2>
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: "0.92rem", marginTop: "2px" }}>{userEmail}</p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ padding: "10px 18px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 600 }}>STATUS</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--success)" }}>Active</div>
              </div>
              <div style={{ padding: "10px 18px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 600 }}>STORAGE</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent)" }}>1.2 / 10 GB</div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Grid: Personal Details Form & App Stats */}
        <div className="translate-studio-grid fade-in">
          
          {/* LEFT PANEL: Comprehensive Personal Details Form */}
          <div className="glass-card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: 10 }}>
              <SettingsIcon size={20} color="var(--accent)" /> Personal Details &amp; Preferences
            </h3>

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              
              {/* Full Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Full Name</label>
                <input
                  type="text"
                  className="text-input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Email Address */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Email Address</label>
                <input
                  type="email"
                  className="text-input"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>

              {/* Phone Number */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Phone Number</label>
                <input
                  type="tel"
                  className="text-input"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* Role / Job Title & Organization Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Role / Occupation</label>
                  <input
                    type="text"
                    className="text-input"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    placeholder="e.g. Content Creator"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Organization</label>
                  <input
                    type="text"
                    className="text-input"
                    value={userOrg}
                    onChange={(e) => setUserOrg(e.target.value)}
                    placeholder="e.g. TransTTS Studio"
                  />
                </div>
              </div>

              {/* Bio / About */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Bio / Short Description</label>
                <textarea
                  className="textarea-input"
                  value={userBio}
                  onChange={(e) => setUserBio(e.target.value)}
                  placeholder="Write a brief bio about yourself..."
                  style={{ minHeight: "80px", resize: "vertical", fontSize: "0.9rem" }}
                />
              </div>

              {/* Default Language Selector */}
              <div className="form-group" style={{ margin: 0 }}>
                <LanguageSelect
                  label="DEFAULT TARGET LANGUAGE"
                  value={defaultLang}
                  onChange={(code) => setDefaultLang(code)}
                  allowAuto={false}
                />
              </div>



              {/* Confirmation Checkbox above Submit button */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "4px", paddingLeft: "2px" }}>
                <input
                  type="checkbox"
                  id="confirm-details-check"
                  checked={confirmDetails}
                  onChange={(e) => setConfirmDetails(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <label htmlFor="confirm-details-check" style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-dim)", cursor: "pointer" }}>
                  I confirm that the personal details provided above are accurate
                </label>
              </div>

              {/* Form Action Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!confirmDetails}
                style={{
                  height: "44px",
                  marginTop: "4px",
                  borderRadius: "100px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: confirmDetails ? 1 : 0.6,
                  cursor: confirmDetails ? "pointer" : "not-allowed",
                  boxShadow: confirmDetails ? "0 4px 14px rgba(255,128,0,0.22)" : "none"
                }}
              >
                <CheckIcon size={18} color="#0a0a0a" />
                <span>Save Personal Details</span>
              </button>

            </form>
          </div>

          {/* RIGHT PANEL: Usage Analytics & Preferences */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Stats Card */}
            <div className="glass-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: 10 }}>
                <BarChartIcon size={20} color="var(--accent)" /> Activity & Usage Summary
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(255,128,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RadioIcon size={20} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>48m</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Audio Recorded</div>
                  </div>
                </div>

                <div style={{ padding: "16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MicIcon size={20} color="var(--success)" />
                  </div>
                  <div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>14</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Transcriptions</div>
                  </div>
                </div>

                <div style={{ padding: "16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <GlobeIcon size={20} color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>28</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Translations</div>
                  </div>
                </div>

                <div style={{ padding: "16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(168,85,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <VolumeIcon size={20} color="#a855f7" />
                  </div>
                  <div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>32</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Voice Clips</div>
                  </div>
                </div>
              </div>
            </div>

            {/* App Preferences Card */}
            <div className="glass-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: 10 }}>
                <SparklesIcon size={20} color="var(--accent)" /> App Preferences
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Auto-Save History</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Save recordings and translations automatically</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => { setAutoSave(e.target.checked); showToast(`Auto-save ${e.target.checked ? "enabled" : "disabled"}`, "info"); }}
                    style={{ width: "20px", height: "20px", accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>

            {/* Security & Account Privacy Card */}
            <div className="glass-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldIcon size={20} color="var(--accent)" /> Security &amp; Account Privacy
              </h3>

              {/* 2FA & Active Sessions 2-Column Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
                {/* Two-Factor Authentication (2FA) */}
                <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Two-Factor Auth (2FA)</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginTop: "2px" }}>Extra account security layer</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={twoFactor}
                    onChange={(e) => {
                      setTwoFactor(e.target.checked);
                      showToast(`2FA Authentication ${e.target.checked ? "enabled" : "disabled"}`, "info");
                    }}
                    style={{ width: "18px", height: "18px", accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                </div>

                {/* Active Login Sessions */}
                <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)" }} /> Active Session
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginTop: "2px" }}>Chrome on Windows</div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>Current</span>
                </div>
              </div>

              {/* Change Password Sub-form */}
              <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <LockIcon size={16} color="var(--accent)" /> Change Password
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Current Password</label>
                  <input
                    type="password"
                    className="text-input"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>New Password</label>
                    <input
                      type="password"
                      className="text-input"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Confirm Password</label>
                    <input
                      type="password"
                      className="text-input"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{
                    height: "40px",
                    marginTop: "4px",
                    borderRadius: "100px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <LockIcon size={14} color="currentColor" />
                  <span>Update Password</span>
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
