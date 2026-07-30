"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/Toast";
import { CheckCircleIcon, SparklesIcon } from "@/components/landing/Icons";

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured yet.",
  google_denied: "Google sign-in was cancelled.",
  google_state: "Google sign-in session expired. Please try again.",
  google_token: "Could not complete Google sign-in.",
  google_userinfo: "Could not read your Google profile.",
  google_unverified: "Your Google email is not verified.",
  google_failed: "Google sign-in failed. Please try again.",
};

function LoginContent() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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

  // If already authenticated (valid session cookie), skip the form.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.push(redirectPath);
      })
      .catch(() => {});
  }, [router, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignUp ? { email, password, name } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || "Authentication failed. Please try again.", "error");
        setIsLoading(false);
        return;
      }

      showToast(
        isSignUp ? "Account created successfully!" : "Logged in successfully!",
        "success"
      );
      router.push(redirectPath);
      router.refresh();
    } catch {
      showToast("Network error. Please try again.", "error");
      setIsLoading(false);
    }
  };



  return (
    <>
      <Navbar />
      <main className="app-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "40px 20px" }}>
        <div className="container" style={{ maxWidth: "1000px" }}>
          
          <div className="teleprompter-grid fade-in" style={{ gridTemplateColumns: "1fr 1.1fr", minHeight: "540px", alignItems: "stretch" }}>
            
            {/* LEFT SIDE: BRANDING / BENEFITS */}
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px", background: "radial-gradient(circle at 10% 10%, rgba(255,128,0,0.08), transparent), #ffffff", borderRight: "1px solid var(--border)", height: "100%" }}>
              <div>
                <div style={{ marginBottom: "20px" }}>
                  <img src="/logo.svg" alt="TransTTS" style={{ height: "32px", width: "auto" }} />
                </div>
                <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "16px", lineHeight: "1.2" }}>
                  Unlock the Power of <span className="gradient-text">AI Audio</span>
                </h2>
                <p style={{ color: "var(--text-dim)", fontSize: "0.95rem", lineHeight: "1.7", marginBottom: "28px" }}>
                  Create a free account to access your personal dashboard, track usage quotas, and manage all your transcription and translation jobs in one place.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <CheckCircleIcon size={18} color="#FF8000" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Save transcripts and generate voices instantly</span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <CheckCircleIcon size={18} color="#FF8000" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Track free monthly usage quotas</span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <CheckCircleIcon size={18} color="#FF8000" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>No credit card required to start</span>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: AUTHENTICATION FORM CARD */}
            <div className="glass-card" style={{ padding: "40px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
              
              {/* Tabs header */}
              <div className="tabs" style={{ marginBottom: "24px" }}>
                <button
                  type="button"
                  className={`tab ${!isSignUp ? "active" : ""}`}
                  style={{ flex: 1, textAlign: "center" }}
                  onClick={() => setIsSignUp(false)}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`tab ${isSignUp ? "active" : ""}`}
                  style={{ flex: 1, textAlign: "center" }}
                  onClick={() => setIsSignUp(true)}
                >
                  Create Account
                </button>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
                {isSignUp ? "Get started free" : "Welcome back"}
              </h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "24px" }}>
                {isSignUp ? "Enter your details to create your TransTTS account" : "Please sign in to access your secure dashboard"}
              </p>



              {/* Google OAuth */}
              <a
                href="/api/auth/google"
                className="btn btn-secondary btn-large"
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px", textDecoration: "none", marginBottom: "8px" }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.3 5.3C41.9 36.2 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"/>
                </svg>
                <span>Continue with Google</span>
              </a>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "16px 0" }}>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>or</span>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {isSignUp && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                )}

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

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                    {!isSignUp && (
                      <Link href="#" style={{ fontSize: "0.78rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                        Forgot?
                      </Link>
                    )}
                  </div>
                  <input
                    type="password"
                    className="text-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-large"
                  style={{ width: "100%", marginTop: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" style={{ marginRight: "8px" }}></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon size={16} color="#0a0a0a" />
                      <span>{isSignUp ? "Create Account" : "Sign In"}</span>
                    </>
                  )}
                </button>
              </form>

            </div>

          </div>

        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
