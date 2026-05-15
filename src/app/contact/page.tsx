"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSubmitted(true);
    showToast("Message sent! We'll get back within 24 hours.", "success");
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
              <form className="glass-card fade-in" onSubmit={handleSubmit}>
                <h3 style={{ marginBottom: 20 }}>📬 Send Us a Message</h3>

                <div className="form-grid">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text" className="select-input" placeholder="Your full name"
                      value={formData.name} onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Work Email *</label>
                    <input
                      type="email" className="select-input" placeholder="you@company.com"
                      value={formData.email} onChange={(e) => handleChange("email", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Company</label>
                    <input
                      type="text" className="select-input" placeholder="Your company name"
                      value={formData.company} onChange={(e) => handleChange("company", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Team Size</label>
                    <select className="select-input" value={formData.teamSize} onChange={(e) => handleChange("teamSize", e.target.value)}>
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
                      className="textarea-input" style={{ minHeight: 140 }}
                      placeholder="Tell us about your use case, expected volume, and any special requirements..."
                      value={formData.message} onChange={(e) => handleChange("message", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-large" style={{ width: "100%", marginTop: 24 }}>
                  📨 Send Message
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
