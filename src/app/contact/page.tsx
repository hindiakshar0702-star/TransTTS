"use client";

import "../landing.css";
import { useState } from "react";
import { z } from "zod";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import {
  MailIcon, SendIcon, CheckCircleIcon, ClockIcon, ShieldIcon,
  InstagramIcon, TwitterXIcon, LinkedinIcon, YoutubeIcon,
} from "@/components/Icons";

const ClientSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  email: z.string().trim().email("Enter a valid email address"),
  subject: z.string().trim().optional(),
  message: z.string().trim().min(10, "Message should be at least 10 characters"),
});

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/transtts", Icon: InstagramIcon },
  { label: "X (Twitter)", href: "https://x.com/transtts", Icon: TwitterXIcon },
  { label: "LinkedIn", href: "https://linkedin.com/company/transtts", Icon: LinkedinIcon },
  { label: "YouTube", href: "https://youtube.com/@transtts", Icon: YoutubeIcon },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = ClientSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="landing-page">
      <LandingNavbar />

      <main className="landing-container" style={{ padding: "96px 0 24px", maxWidth: 1000 }}>
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 40px" }}>
          <span className="about-eyebrow">Contact Us</span>
          <h1 className="about-title" style={{ fontSize: "clamp(1.9rem, 4.5vw, 2.8rem)" }}>
            Let&apos;s <span className="gradient-text">talk</span>.
          </h1>
          <p className="about-lead">
            Questions, feedback, or a partnership idea? Send a message and we&apos;ll get back to you.
          </p>
        </div>

        <div className="contact-layout">
          {/* Info column */}
          <aside className="contact-info">
            <div className="contact-info-item">
              <span className="about-card-icon"><MailIcon size={20} color="#FF8000" /></span>
              <div>
                <h3>Email us</h3>
                <p><a href="mailto:hello@transtts.ai">hello@transtts.ai</a></p>
              </div>
            </div>
            <div className="contact-info-item">
              <span className="about-card-icon"><ClockIcon size={20} color="#FF8000" /></span>
              <div>
                <h3>Response time</h3>
                <p>We usually reply within 24 hours, Mon–Fri.</p>
              </div>
            </div>
            <div className="contact-info-item">
              <span className="about-card-icon"><ShieldIcon size={20} color="#FF8000" /></span>
              <div>
                <h3>No spam</h3>
                <p>Your details are used only to reply to you.</p>
              </div>
            </div>
            <div className="contact-socials">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="contact-social">
                  <Icon size={18} color="currentColor" />
                </a>
              ))}
            </div>
          </aside>

          {/* Form column */}
          <div className="contact-form-card">
            {status === "sent" ? (
              <div style={{ textAlign: "center", padding: "40px 8px" }}>
                <CheckCircleIcon size={56} color="#16a34a" />
                <h2 style={{ margin: "16px 0 8px", color: "var(--color-landing-text)" }}>Message sent</h2>
                <p style={{ color: "var(--color-landing-text-dim)" }}>
                  Thanks for reaching out — we&apos;ll get back to you soon.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="contact-field">
                  <label htmlFor="c-name">Name</label>
                  <input id="c-name" type="text" value={form.name}
                    onChange={(e) => set("name", e.target.value)} placeholder="Your name" autoComplete="name" />
                </div>
                <div className="contact-field">
                  <label htmlFor="c-email">Email</label>
                  <input id="c-email" type="email" value={form.email}
                    onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" autoComplete="email" />
                </div>
                <div className="contact-field">
                  <label htmlFor="c-subject">Subject <span className="contact-optional">(optional)</span></label>
                  <input id="c-subject" type="text" value={form.subject}
                    onChange={(e) => set("subject", e.target.value)} placeholder="What's this about?" />
                </div>
                <div className="contact-field">
                  <label htmlFor="c-message">Message</label>
                  <textarea id="c-message" value={form.message}
                    onChange={(e) => set("message", e.target.value)} placeholder="Tell us more..." rows={6} />
                </div>

                {error && <p className="contact-error" role="alert">{error}</p>}

                <button type="submit" className="btn btn-primary" disabled={status === "sending"}
                  style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <SendIcon size={16} color="#0a0a0a" />
                  {status === "sending" ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
