import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { sendMail } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * Public contact endpoint. Validates input with zod, rate-limits per IP (spam
 * defense), and forwards the message via the existing mail transport
 * (SMTP → Resend → dev-log). No auth required — anyone may reach out.
 *
 * Destination: CONTACT_TO env, falling back to MAIL_FROM / SMTP_USER. If no
 * mail transport is configured, sendMail logs to the server console (dev), so
 * the submission is never silently lost.
 */

const ContactSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("Enter a valid email").max(200),
  subject: z.string().trim().max(150).optional().default(""),
  // Honeypot: bots fill hidden fields; humans leave it empty.
  company: z.string().max(0).optional().default(""),
  message: z.string().trim().min(10, "Message is too short").max(5000),
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export async function POST(req: NextRequest) {
  // 5 messages / 10 min per IP.
  const limited = guard(req, "contact", { limit: 5, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message || "Invalid input.";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { name, email, subject, company, message } = parsed.data;

  // Honeypot tripped — pretend success, drop the message.
  if (company) return NextResponse.json({ ok: true });

  const to = process.env.CONTACT_TO || process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!to) {
    // Still don't lose it: sendMail's dev fallback logs to console.
    console.warn("[contact] No CONTACT_TO/MAIL_FROM configured — logging message only.");
  }

  const subj = subject || "New contact message";
  const text =
    `New TransTTS contact message\n\n` +
    `Name: ${name}\nEmail: ${email}\nSubject: ${subj}\n\n${message}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;color:#111">
      <h2 style="margin:0 0 12px">New contact message</h2>
      <p style="margin:4px 0"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin:4px 0"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="margin:4px 0"><strong>Subject:</strong> ${escapeHtml(subj)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
      <p style="white-space:pre-wrap;line-height:1.6;color:#333">${escapeHtml(message)}</p>
    </div>`;

  const sent = await sendMail({
    to: to || email,
    subject: `[TransTTS Contact] ${subj}`,
    html,
    text,
  });

  if (!sent) {
    return NextResponse.json(
      { error: "Could not send your message right now. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
