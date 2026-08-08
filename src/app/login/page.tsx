"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import "../landing.css";
import LandingNavbar from "@/components/landing/LandingNavbar";
import { useToast } from "@/components/Toast";
import { CheckCircleIcon, ShieldIcon } from "@/components/landing/Icons";

// Auth.js v5 redirects OAuth failures back with ?error=<code>.
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
  AccessDenied: "Google sign-in was cancelled or denied.",
  Configuration: "Google sign-in is not configured correctly.",
  Verification: "Sign-in link is invalid or has expired.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Could not complete Google sign-in. Please try again.",
};

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const redirectPath = searchParams.get("redirect") || "/dashboard";

  // Surface Google OAuth failures (callback redirects back with ?error=...).
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) showToast(OAUTH_ERRORS[err] || "Sign-in failed. Please try again.", "error");
  }, [searchParams, showToast]);

  // If already authenticated (valid session cookie), skip the sign-in screen.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.push(redirectPath);
      })
      .catch(() => {});
  }, [router, redirectPath]);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    // Full-page redirect to Google; nothing after this runs on success.
    signIn("google", { callbackUrl: redirectPath }).catch(() => {
      showToast("Could not start Google sign-in. Please try again.", "error");
      setIsLoading(false);
    });
  };

  return (
    <>
      <LandingNavbar />
      <main
        className="app-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "108px 20px 40px",
        }}
      >
        <div className="container" style={{ maxWidth: "1000px" }}>
          <div
            className="teleprompter-grid fade-in"
            style={{ gridTemplateColumns: "1fr 1.1fr", minHeight: "460px", alignItems: "stretch" }}
          >
            {/* LEFT: BRANDING / BENEFITS */}
            <div
              className="glass-card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "40px",
                background:
                  "radial-gradient(circle at 10% 10%, rgba(255,128,0,0.08), transparent), var(--bg-card)",
                borderRight: "1px solid var(--border)",
                height: "100%",
              }}
            >
              <div>
                <div style={{ marginBottom: "20px" }}>
                  <img src="/logo.svg" alt="TransTTS" style={{ height: "32px", width: "auto" }} />
                </div>
                <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "16px", lineHeight: "1.2" }}>
                  Unlock the Power of <span className="gradient-text">AI Audio</span>
                </h2>
                <p style={{ color: "var(--text-dim)", fontSize: "0.95rem", lineHeight: "1.7", marginBottom: "28px" }}>
                  Sign in with Google to reach your dashboard and keep every transcription,
                  translation and generated voice in one place.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <CheckCircleIcon size={18} color="#FF8000" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Save transcripts and generate voices instantly</span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <CheckCircleIcon size={18} color="#FF8000" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Everything free — no card, no plan to pick</span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <CheckCircleIcon size={18} color="#FF8000" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>No password to create or remember</span>
                </div>
              </div>
            </div>

            {/* RIGHT: SIGN-IN CARD */}
            <div
              className="glass-card"
              style={{
                padding: "40px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "8px" }}>Welcome</h1>
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: "32px", lineHeight: 1.6 }}>
                Continue with your Google account. If it&apos;s your first time here, your account is
                created automatically.
              </p>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="btn btn-secondary btn-large"
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  cursor: isLoading ? "wait" : "pointer",
                }}
              >
                {isLoading ? (
                  <>
                    <div className="spinner" />
                    <span>Redirecting to Google…</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.3 5.3C41.9 36.2 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginTop: "28px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "var(--glass)",
                  border: "1px solid var(--border)",
                }}
              >
                <ShieldIcon size={16} color="#FF8000" />
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
                  We only receive your name, email address and profile picture. TransTTS never sees
                  your Google password.
                </span>
              </div>

              <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "24px", lineHeight: 1.6 }}>
                By continuing you agree to our{" "}
                <a href="/terms-and-conditions" style={{ color: "var(--accent-text)", textDecoration: "underline" }}>Terms</a> and{" "}
                <a href="/privacy-policy" style={{ color: "var(--accent-text)", textDecoration: "underline" }}>Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
