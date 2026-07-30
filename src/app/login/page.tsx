"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/Toast";
import { CheckCircleIcon, SparklesIcon } from "@/components/landing/Icons";

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

  // If already logged in, send to dashboard directly
  useEffect(() => {
    if (typeof window !== "undefined") {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      if (loggedIn) {
        router.push(redirectPath);
      }
    }
  }, [router, redirectPath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    setIsLoading(true);

    // Simulate network authentication request
    setTimeout(() => {
      setIsLoading(false);
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userName", isSignUp ? name : email.split("@")[0]);
      
      showToast(
        isSignUp ? "Account created successfully!" : "Logged in successfully!",
        "success"
      );
      router.push(redirectPath);
    }, 1200);
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
