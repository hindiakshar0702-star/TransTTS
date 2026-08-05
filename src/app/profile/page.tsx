"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { validatePassword } from "@/lib/password";
import PasswordEyeToggle from "@/components/PasswordEyeToggle";
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
  const router = useRouter();
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userOrg, setUserOrg] = useState("");
  const [userBio, setUserBio] = useState("");
  const [defaultLang, setDefaultLang] = useState("hi");
  const [defaultVoice, setDefaultVoice] = useState("hi-female");
  const [autoSave, setAutoSave] = useState(true);
  const [confirmDetails, setConfirmDetails] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Load the persisted profile from the server (source of truth is the DB, not
  // localStorage — so the Sidebar/session and this page stay in sync).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.ok) {
          const { user } = await res.json();
          if (!cancelled && user) {
            setUserName(user.name || "");
            setUserEmail(user.email || "");
            setUserAvatar(user.image || "");
            setUserPhone(user.phone || "");
            setUserRole(user.jobTitle || "");
            setUserOrg(user.organization || "");
            setUserBio(user.bio || "");
            setDefaultLang(user.defaultLang || "hi");
            setDefaultVoice(user.defaultVoice || "hi-female");
          }
        }
      } catch {
        /* proxy redirects unauthenticated users to /login already */
      } finally {
        if (!cancelled) setIsAuth(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass) {
      showToast("Please enter your current password", "error");
      return;
    }
    // Enforce the shared password policy client-side (server re-checks).
    const pw = validatePassword(newPass, userEmail);
    if (!pw.ok) {
      showToast(pw.errors[0], "error");
      return;
    }
    if (newPass !== confirmPass) {
      showToast("New password and confirm password do not match", "error");
      return;
    }
    setChangingPass(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not change password.", "error");
        return;
      }
      // The password change revoked all sessions (this one included). Re-mint
      // THIS device's session with the new password so the user stays signed in.
      if (data.email) {
        await signIn("credentials", { email: data.email, password: newPass, redirect: false });
      }
      showToast("Password updated. Other devices have been signed out.", "success");
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setChangingPass(false);
    }
  };

  // Revoke every session for this account (bumps User.tokenVersion server-side),
  // then send the user back to /login since the current cookie is now dead too.
  const handleLogoutAll = async () => {
    if (!window.confirm("Log out of all devices? You'll need to sign in again everywhere.")) {
      return;
    }
    setLoggingOutAll(true);
    try {
      const res = await fetch("/api/auth/logout-all", { method: "POST" });
      if (!res.ok) {
        showToast("Could not log out other sessions. Please try again.", "error");
        setLoggingOutAll(false);
        return;
      }
      showToast("Logged out of all devices.", "success");
      router.push("/login");
    } catch {
      showToast("Network error. Please try again.", "error");
      setLoggingOutAll(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // ~2MB binary → the server caps the base64 payload at 3M chars.
    if (f.size > 2 * 1024 * 1024) {
      showToast("Image size must be under 2MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const prev = userAvatar;
      setUserAvatar(result); // optimistic
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: result }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "" }));
          setUserAvatar(prev); // roll back
          showToast(error || "Could not update photo.", "error");
          return;
        }
        showToast("Profile photo updated!", "success");
      } catch {
        setUserAvatar(prev);
        showToast("Network error. Please try again.", "error");
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // email/role are intentionally NOT sent — identity/privilege are
        // fixed server-side and would be ignored anyway.
        body: JSON.stringify({
          name: userName,
          phone: userPhone,
          jobTitle: userRole,
          organization: userOrg,
          bio: userBio,
          defaultLang,
          defaultVoice,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not save profile.", "error");
        return;
      }
      showToast("Personal details saved successfully!", "success");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
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
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: "44px", padding: "0 22px", fontWeight: 700, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}
            >
              <CheckIcon size={18} color="#0a0a0a" />
              <span>{saving ? "Saving…" : "Save Profile"}</span>
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
                  readOnly
                  title="Email is your login identity and cannot be changed here."
                  placeholder="Enter your email address"
                  style={{ opacity: 0.7, cursor: "not-allowed" }}
                />
              </div>

              {/* Phone Number */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Phone Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
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
                disabled={!confirmDetails || saving}
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
                  opacity: confirmDetails && !saving ? 1 : 0.6,
                  cursor: confirmDetails && !saving ? "pointer" : "not-allowed",
                  boxShadow: confirmDetails ? "0 4px 14px rgba(255,128,0,0.22)" : "none"
                }}
              >
                <CheckIcon size={18} color="#0a0a0a" />
                <span>{saving ? "Saving…" : "Save Personal Details"}</span>
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

              {/* Log out of all devices — revokes every active session */}
              <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Log Out Everywhere</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginTop: "2px" }}>
                    Sign out of every device and browser, including this one
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogoutAll}
                  disabled={loggingOutAll}
                  style={{
                    height: "38px",
                    padding: "0 18px",
                    borderRadius: "100px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    background: "transparent",
                    color: "#ef4444",
                    border: "1px solid #ef4444",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: loggingOutAll ? "not-allowed" : "pointer",
                    opacity: loggingOutAll ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {loggingOutAll ? (
                    <><div className="spinner" style={{ width: 14, height: 14 }} />Logging out…</>
                  ) : (
                    <><LockIcon size={14} color="currentColor" /><span>Log Out All Devices</span></>
                  )}
                </button>
              </div>

              {/* Change Password Sub-form */}
              <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <LockIcon size={16} color="var(--accent)" /> Change Password
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Current Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPasswords ? "text" : "password"}
                      className="text-input"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={changingPass}
                      style={{ paddingRight: "40px", width: "100%" }}
                    />
                    <PasswordEyeToggle shown={showPasswords} onToggle={() => setShowPasswords((s) => !s)} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>New Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPasswords ? "text" : "password"}
                        className="text-input"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        minLength={8}
                        disabled={changingPass}
                        style={{ paddingRight: "40px", width: "100%" }}
                      />
                      <PasswordEyeToggle shown={showPasswords} onToggle={() => setShowPasswords((s) => !s)} />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Confirm Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPasswords ? "text" : "password"}
                        className="text-input"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        minLength={8}
                        disabled={changingPass}
                        style={{ paddingRight: "40px", width: "100%" }}
                      />
                      <PasswordEyeToggle shown={showPasswords} onToggle={() => setShowPasswords((s) => !s)} />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={changingPass}
                  style={{
                    height: "40px",
                    marginTop: "4px",
                    borderRadius: "100px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    opacity: changingPass ? 0.6 : 1,
                    cursor: changingPass ? "not-allowed" : "pointer",
                  }}
                >
                  {changingPass ? (
                    <><div className="spinner" style={{ width: 14, height: 14 }} />Updating…</>
                  ) : (
                    <><LockIcon size={14} color="currentColor" /><span>Update Password</span></>
                  )}
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
