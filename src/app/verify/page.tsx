"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import OtpInput from "@/components/OtpInput";
import { useToast } from "@/components/Toast";
import { useSession } from "@/lib/useSession";
import { CheckCircleIcon, SparklesIcon } from "@/components/landing/Icons";

type Tab = "email" | "mobile";

function VerifyContent() {
  const { user, loading, refresh } = useSession();
  const { showToast } = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("email");

  // Email state
  const [emailCode, setEmailCode] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Mobile state
  const [phone, setPhone] = useState("");
  const [mobileStep, setMobileStep] = useState<"enter" | "otp">("enter");
  const [mobileCode, setMobileCode] = useState("");
  const [mobileCooldown, setMobileCooldown] = useState(0);
  const [mobileBusy, setMobileBusy] = useState(false);
  const [mobileError, setMobileError] = useState("");

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/verify");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.phone) setPhone((p) => p || user.phone!);
  }, [user]);

  // Single ticker drives both cooldown counters.
  useEffect(() => {
    if (emailCooldown <= 0 && mobileCooldown <= 0) return;
    const t = setInterval(() => {
      setEmailCooldown((s) => (s > 0 ? s - 1 : 0));
      setMobileCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [emailCooldown, mobileCooldown]);

  const post = useCallback(async (url: string, body?: object) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }, []);

  // --- Email ---
  const sendEmail = async () => {
    setEmailBusy(true);
    setEmailError("");
    try {
      const { res, data } = await post("/api/auth/otp/email/send");
      if (res.ok) {
        if (data.alreadyVerified) { await refresh(); return; }
        setEmailCooldown(data.cooldownSeconds ?? 60);
        showToast("Verification code sent to your email.", "success");
      } else {
        if (data.cooldown) setEmailCooldown(data.cooldown);
        setEmailError(data.error || "Could not send code.");
      }
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyEmail = async () => {
    if (emailCode.length !== 6) { setEmailError("Enter the 6-digit code."); return; }
    setEmailBusy(true);
    setEmailError("");
    try {
      const { res, data } = await post("/api/auth/otp/email/verify", { code: emailCode });
      if (res.ok) {
        showToast("Email verified!", "success");
        setEmailCode("");
        await refresh();
      } else {
        setEmailError(
          data.reason === "invalid" && typeof data.remaining === "number"
            ? `${data.error} ${data.remaining} attempt(s) left.`
            : data.error || "Verification failed."
        );
        if (data.reason === "too_many_attempts" || data.reason === "expired") setEmailCode("");
      }
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  };

  // --- Mobile ---
  const sendMobile = async () => {
    setMobileBusy(true);
    setMobileError("");
    try {
      const { res, data } = await post("/api/auth/otp/mobile/send", { phone });
      if (res.ok) {
        if (data.alreadyVerified) { await refresh(); return; }
        setMobileStep("otp");
        setMobileCooldown(data.cooldownSeconds ?? 60);
        showToast("Verification code sent by SMS.", "success");
      } else {
        if (data.cooldown) setMobileCooldown(data.cooldown);
        setMobileError(data.error || "Could not send code.");
      }
    } catch {
      setMobileError("Network error. Please try again.");
    } finally {
      setMobileBusy(false);
    }
  };

  const verifyMobile = async () => {
    if (mobileCode.length !== 6) { setMobileError("Enter the 6-digit code."); return; }
    setMobileBusy(true);
    setMobileError("");
    try {
      const { res, data } = await post("/api/auth/otp/mobile/verify", { code: mobileCode });
      if (res.ok) {
        showToast("Phone verified!", "success");
        setMobileCode("");
        await refresh();
      } else {
        setMobileError(
          data.reason === "invalid" && typeof data.remaining === "number"
            ? `${data.error} ${data.remaining} attempt(s) left.`
            : data.error || "Verification failed."
        );
        if (data.reason === "too_many_attempts" || data.reason === "expired") setMobileCode("");
      }
    } catch {
      setMobileError("Network error. Please try again.");
    } finally {
      setMobileBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const errorStyle = { fontSize: "0.8rem", color: "#ef4444", marginTop: "10px", display: "block" } as const;
  const bothDone = user.emailVerified && user.phoneVerified;

  return (
    <>
      <Navbar />
      <main className="app-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "40px 20px" }}>
        <div className="container" style={{ maxWidth: "480px" }}>
          <div className="glass-card fade-in" style={{ padding: "36px" }}>
            <img src="/logo.svg" alt="TransTTS" style={{ height: "32px", width: "auto", marginBottom: "20px" }} />
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "6px" }}>Verify your account</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: "24px", lineHeight: 1.6 }}>
              Confirm your email and phone to secure your account. You can do either, both, or skip for now.
            </p>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: "24px" }}>
              <button type="button" className={`tab ${tab === "email" ? "active" : ""}`} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setTab("email")}>
                Email {user.emailVerified && <CheckCircleIcon size={15} color="#22c55e" />}
              </button>
              <button type="button" className={`tab ${tab === "mobile" ? "active" : ""}`} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setTab("mobile")}>
                Mobile {user.phoneVerified && <CheckCircleIcon size={15} color="#22c55e" />}
              </button>
            </div>

            {/* EMAIL TAB */}
            {tab === "email" && (
              <div>
                {user.emailVerified ? (
                  <VerifiedBlock label="Email verified" detail={user.email} />
                ) : (
                  <>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-dim)", marginBottom: "16px" }}>
                      We&apos;ll send a 6-digit code to <strong style={{ color: "var(--text)" }}>{user.email}</strong>.
                    </p>
                    <OtpInput value={emailCode} onChange={setEmailCode} disabled={emailBusy} />
                    {emailError && <span style={errorStyle}>{emailError}</span>}
                    <button type="button" className="btn btn-primary btn-large" onClick={verifyEmail} disabled={emailBusy || emailCode.length !== 6} style={{ width: "100%", marginTop: "18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {emailBusy ? <><div className="spinner" style={{ width: 16, height: 16 }} />Verifying…</> : <><SparklesIcon size={16} color="#0a0a0a" />Verify Email</>}
                    </button>
                    <ResendRow cooldown={emailCooldown} busy={emailBusy} onResend={sendEmail} />
                  </>
                )}
              </div>
            )}

            {/* MOBILE TAB */}
            {tab === "mobile" && (
              <div>
                {user.phoneVerified ? (
                  <VerifiedBlock label="Phone verified" detail={user.phone ?? ""} />
                ) : mobileStep === "enter" ? (
                  <>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="text-input"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={mobileBusy}
                      style={{ width: "100%" }}
                    />
                    <p style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginTop: "6px" }}>
                      Include your country code (E.164), e.g. +91… for India.
                    </p>
                    {mobileError && <span style={errorStyle}>{mobileError}</span>}
                    <button type="button" className="btn btn-primary btn-large" onClick={sendMobile} disabled={mobileBusy || !phone.trim()} style={{ width: "100%", marginTop: "18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {mobileBusy ? <><div className="spinner" style={{ width: 16, height: 16 }} />Sending…</> : <><SparklesIcon size={16} color="#0a0a0a" />Send SMS Code</>}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-dim)", marginBottom: "16px" }}>
                      Enter the 6-digit code sent to <strong style={{ color: "var(--text)" }}>{phone}</strong>.{" "}
                      <button type="button" onClick={() => { setMobileStep("enter"); setMobileError(""); setMobileCode(""); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}>Change</button>
                    </p>
                    <OtpInput value={mobileCode} onChange={setMobileCode} disabled={mobileBusy} />
                    {mobileError && <span style={errorStyle}>{mobileError}</span>}
                    <button type="button" className="btn btn-primary btn-large" onClick={verifyMobile} disabled={mobileBusy || mobileCode.length !== 6} style={{ width: "100%", marginTop: "18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {mobileBusy ? <><div className="spinner" style={{ width: 16, height: 16 }} />Verifying…</> : <><SparklesIcon size={16} color="#0a0a0a" />Verify Phone</>}
                    </button>
                    <ResendRow cooldown={mobileCooldown} busy={mobileBusy} onResend={sendMobile} />
                  </>
                )}
              </div>
            )}

            {/* Continue */}
            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <button type="button" onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: bothDone ? "var(--accent)" : "var(--text-dim)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                {bothDone ? "All done — go to dashboard →" : "Skip for now →"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function VerifiedBlock({ label, detail }: { label: string; detail: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "24px 0" }}>
      <CheckCircleIcon size={48} color="#22c55e" />
      <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{label}</div>
      {detail && <div style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>{detail}</div>}
    </div>
  );
}

function ResendRow({ cooldown, busy, onResend }: { cooldown: number; busy: boolean; onResend: () => void }) {
  return (
    <div style={{ textAlign: "center", marginTop: "16px", fontSize: "0.82rem", color: "var(--text-dim)" }}>
      Didn&apos;t get it?{" "}
      <button
        type="button"
        onClick={onResend}
        disabled={busy || cooldown > 0}
        style={{ background: "none", border: "none", color: cooldown > 0 ? "var(--text-dim)" : "var(--accent)", fontWeight: 600, cursor: cooldown > 0 || busy ? "not-allowed" : "pointer", padding: 0 }}
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
