"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/Toast";
import { SparklesIcon, CheckCircleIcon } from "@/components/landing/Icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      showToast("Enter a valid email address.", "error");
      return;
    }
    setIsLoading(true);
    try {
      await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Response is intentionally generic (no account enumeration).
      setSent(true);
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="app-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "40px 20px" }}>
        <div className="container" style={{ maxWidth: "440px" }}>
          <div className="glass-card fade-in" style={{ padding: "40px" }}>
            <img src="/logo.svg" alt="TransTTS" style={{ height: "32px", width: "auto", marginBottom: "24px" }} />

            {sent ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                  <CheckCircleIcon size={48} color="#22c55e" />
                </div>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>Check your inbox</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "24px" }}>
                  If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
                </p>
                <Link href="/login" className="btn btn-secondary btn-large" style={{ width: "100%", textDecoration: "none", display: "inline-flex", justifyContent: "center" }}>
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>Reset your password</h3>
                <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: "24px", lineHeight: 1.6 }}>
                  Enter your account email and we&apos;ll send you a link to set a new password.
                </p>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="text-input"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-large" style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }} disabled={isLoading}>
                    {isLoading ? (
                      <><div className="spinner" style={{ marginRight: "8px" }}></div>Sending...</>
                    ) : (
                      <><SparklesIcon size={16} color="#0a0a0a" /><span>Send reset link</span></>
                    )}
                  </button>
                </form>
                <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.82rem" }}>
                  <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
