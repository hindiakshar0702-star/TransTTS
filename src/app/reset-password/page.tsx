"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "../landing.css";
import LandingNavbar from "@/components/landing/LandingNavbar";
import { useToast } from "@/components/Toast";
import { SparklesIcon } from "@/components/landing/Icons";
import { validatePassword, passwordStrength } from "@/lib/password";
import PasswordEyeToggle from "@/components/PasswordEyeToggle";

const STRENGTH_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#22c55e"];

function ResetContent() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const token = searchParams.get("token") || "";

  const strength = passwordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      showToast("Invalid or expired reset link.", "error");
      return;
    }
    const pw = validatePassword(password);
    if (!pw.ok) {
      showToast(pw.errors[0], "error");
      return;
    }
    if (password !== confirm) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not reset password.", "error");
        setIsLoading(false);
        return;
      }
      showToast("Password updated. Please sign in.", "success");
      router.push("/login");
    } catch {
      showToast("Network error. Please try again.", "error");
      setIsLoading(false);
    }
  };

  return (
    <>
      <LandingNavbar />
      <main className="app-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "108px 20px 40px" }}>
        <div className="container" style={{ maxWidth: "440px" }}>
          <div className="glass-card fade-in" style={{ padding: "40px" }}>
            <img src="/logo.svg" alt="TransTTS" style={{ height: "32px", width: "auto", marginBottom: "24px" }} />
            <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>Set a new password</h3>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: "24px", lineHeight: 1.6 }}>
              Choose a strong password you don&apos;t use anywhere else.
            </p>

            {!token ? (
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
                This reset link is missing its token.{" "}
                <Link href="/forgot-password" style={{ color: "var(--accent)", fontWeight: 600 }}>Request a new one</Link>.
              </p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">New Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="text-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={{ paddingRight: "40px", width: "100%" }}
                      disabled={isLoading}
                    />
                    <PasswordEyeToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} disabled={isLoading} />
                  </div>
                  {password.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} style={{ flex: 1, height: "4px", borderRadius: "2px", background: i < strength.score ? STRENGTH_COLORS[strength.score - 1] : "var(--border)", transition: "background 0.2s" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px", display: "block" }}>
                        Strength: <strong style={{ color: STRENGTH_COLORS[Math.max(0, strength.score - 1)] }}>{strength.label}</strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Confirm Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="text-input"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <span style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: "4px", display: "block" }}>
                      Passwords do not match.
                    </span>
                  )}
                </div>

                <button type="submit" className="btn btn-primary btn-large" style={{ width: "100%", marginTop: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }} disabled={isLoading}>
                  {isLoading ? (
                    <><div className="spinner" style={{ marginRight: "8px" }}></div>Updating...</>
                  ) : (
                    <><SparklesIcon size={16} color="#0a0a0a" /><span>Update password</span></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    }>
      <ResetContent />
    </Suspense>
  );
}
