"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useToast } from "@/components/Toast";

/**
 * Where contact submissions are sent.
 *
 * - If NEXT_PUBLIC_FORMSUBMIT_EMAIL is set at build time, we POST directly
 *   to https://formsubmit.co/ajax/<email> — no backend / DB / API key
 *   required. Submissions land in that inbox.
 * - Otherwise we fall back to our own POST /api/contact endpoint
 *   (DB-backed, optional Resend email).
 *
 * Both paths preserve the same UX: nice success card, inline errors,
 * loading state, honeypot.
 */
const FORMSUBMIT_TARGET = process.env.NEXT_PUBLIC_FORMSUBMIT_EMAIL || "";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  // Honeypot — invisible to humans, irresistible to scraping bots.
  const [website, setWebsite] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    // Client-side validation — server re-validates everything anyway
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError("Please fill all required fields.");
      showToast("Please fill all required fields", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address.");
      showToast("Invalid email", "error");
      return;
    }
    if (formData.message.trim().length < 10) {
      setError("Please write at least 10 characters in your message.");
      showToast("Message too short", "error");
      return;
    }

    setLoading(true);
    try {
      if (FORMSUBMIT_TARGET) {
        await submitToFormSubmit(FORMSUBMIT_TARGET, formData, website);
      } else {
        await submitToBackend(formData, website);
      }

      setSubmitted(true);
      showToast("Message sent! We'll get back within 24 hours.", "success");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not reach the server. Please try again.";
      setError(msg);
      showToast(msg.startsWith("Could not") ? "Network error — please retry" : msg, "error");
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container" style={{ maxWidth: 800 }}>
          <div className="app-header fade-in">
            <h1>🏢 <span className="gradient-text">Contact Sales</span></h1>
            <p>Get a custom Enterprise plan tailored for your team</p>
          </div>

          {submitted ? (
            <div className="glass-card fade-in" style={{ textAlign: "center", padding: "60px 32px" }}>
              <div style={{ fontSize: "4rem", marginBottom: 16 }}>✅</div>
              <h2 style={{ marginBottom: 12 }}>Thank You!</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 8, fontSize: "1.05rem" }}>
                We&apos;ve received your inquiry and will get back to you within <strong>24 hours</strong>.
              </p>
              <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
                Check your email at <strong>{formData.email}</strong> for confirmation.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link href="/pricing" className="btn btn-outline">← Back to Pricing</Link>
                <Link href="/transcribe" className="btn btn-primary">🎤 Start Transcribing</Link>
              </div>
            </div>
          ) : (
            <>
              {/* Enterprise Benefits */}
              <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16 }}>🎯 Enterprise Benefits</h3>
                <div className="enterprise-benefits">
                  {[
                    { icon: "♾️", title: "Unlimited Everything", desc: "No caps on transcriptions, translations, or TTS" },
                    { icon: "🎧", title: "Custom Neural Voices", desc: "Train voices with your brand's personality" },
                    { icon: "🔌", title: "Full API Access", desc: "REST API for seamless integration" },
                    { icon: "📊", title: "Team Analytics", desc: "Usage tracking across your organization" },
                    { icon: "🛡️", title: "SLA & Support", desc: "99.9% uptime with dedicated account manager" },
                    { icon: "🔒", title: "Data Privacy", desc: "SOC2 compliant, on-premise option available" },
                  ].map((b) => (
                    <div key={b.title} className="benefit-item">
                      <span style={{ fontSize: "1.3rem" }}>{b.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{b.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Form */}
              <form className="glass-card fade-in" onSubmit={handleSubmit} noValidate>
                <h3 style={{ marginBottom: 20 }}>📬 Send Us a Message</h3>

                <div className="form-grid">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="select-input"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      disabled={loading}
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Work Email *</label>
                    <input
                      type="email"
                      className="select-input"
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      disabled={loading}
                      autoComplete="email"
                      maxLength={200}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Company</label>
                    <input
                      type="text"
                      className="select-input"
                      placeholder="Your company name"
                      value={formData.company}
                      onChange={(e) => handleChange("company", e.target.value)}
                      disabled={loading}
                      autoComplete="organization"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="form-label">Team Size</label>
                    <select
                      className="select-input"
                      value={formData.teamSize}
                      onChange={(e) => handleChange("teamSize", e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select team size</option>
                      <option value="1-5">1-5 members</option>
                      <option value="6-20">6-20 members</option>
                      <option value="21-50">21-50 members</option>
                      <option value="51-100">51-100 members</option>
                      <option value="100+">100+ members</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">How can we help? *</label>
                    <textarea
                      className="textarea-input"
                      style={{ minHeight: 140 }}
                      placeholder="Tell us about your use case, expected volume, and any special requirements..."
                      value={formData.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                      disabled={loading}
                      maxLength={4000}
                      required
                    />
                    <div className="char-count">{formData.message.length} / 4,000 characters</div>
                  </div>
                </div>

                {/*
                  Honeypot field — hidden from humans (off-screen + aria-hidden + tabIndex=-1)
                  but real DOM input that bots will eagerly fill in. Server drops any
                  submission where this is non-empty.
                */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    top: "-9999px",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                  }}
                >
                  <label>
                    Website (leave blank)
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      name="website"
                    />
                  </label>
                </div>

                {error && (
                  <div
                    className="badge badge-error"
                    style={{ padding: "12px 18px", fontSize: "0.9rem", marginTop: 16, width: "100%", justifyContent: "flex-start" }}
                  >
                    ❌ {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-large"
                  style={{ width: "100%", marginTop: 24 }}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="spinner"></span> Sending...</>
                  ) : (
                    "📨 Send Message"
                  )}
                </button>

                <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 12 }}>
                  We typically respond within 24 hours • No spam, ever
                </p>
              </form>

              {/* Alternative contact */}
              <div className="glass-card fade-in" style={{ marginTop: 24, textAlign: "center" }}>
                <h3 style={{ marginBottom: 12 }}>📞 Prefer to talk?</h3>
                <p style={{ color: "var(--text-dim)", marginBottom: 4 }}>
                  Email us directly: <strong style={{ color: "var(--accent)" }}>enterprise@transtts.ai</strong>
                </p>
                <p style={{ color: "var(--text-dim)" }}>
                  Or schedule a call: <strong style={{ color: "var(--accent)" }}>Mon-Fri, 10AM - 6PM IST</strong>
                </p>
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <Link href="/pricing" className="btn btn-ghost">← Back to Pricing</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/* -------------------------------------------------------------------- */
/* Submission strategies                                                 */
/* -------------------------------------------------------------------- */

interface FormPayload {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  message: string;
}

/**
 * POST to our own /api/contact route.
 * Persists to ContactInquiry, optionally fires admin + auto-reply emails
 * via Resend (see CONTACT_SETUP.md). Throws on non-2xx.
 */
async function submitToBackend(formData: FormPayload, website: string): Promise<void> {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formData, website }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Failed to send message (${res.status})`);
  }
}

/**
 * POST to FormSubmit.co's AJAX endpoint.
 *
 * No signup is required — the first time submissions hit a new email,
 * FormSubmit sends an activation link to that mailbox. After clicking
 * the link once, every subsequent submission is delivered immediately.
 *
 * `_honey` is FormSubmit's built-in honeypot, so we forward the same
 * `website` value the rest of the app already collects.
 */
async function submitToFormSubmit(
  emailOrAlias: string,
  formData: FormPayload,
  website: string
): Promise<void> {
  const url = `https://formsubmit.co/ajax/${encodeURIComponent(emailOrAlias)}`;
  const subject = `New TransTTS contact: ${formData.name}${
    formData.company ? ` (${formData.company})` : ""
  }`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      company: formData.company,
      "Team size": formData.teamSize,
      message: formData.message,
      _subject: subject,
      _replyto: formData.email,
      _captcha: "false",
      _template: "table",
      _honey: website,
    }),
  });

  const data = await res.json().catch(() => ({}));
  const succeeded =
    res.ok && (data?.success === "true" || data?.success === true);

  if (!succeeded) {
    const detail =
      typeof data?.message === "string"
        ? data.message
        : `FormSubmit error (${res.status})`;
    throw new Error(detail);
  }
}
