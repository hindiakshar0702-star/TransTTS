/**
 * Minimal, dependency-free mail sender. Uses the Resend HTTP API when
 * RESEND_API_KEY is configured; otherwise falls back to logging the message to
 * the server console so local/dev flows still work without an email provider.
 *
 * Node-only (reads env, does network I/O). Never import from middleware.
 */

export const runtime = "nodejs";

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Best-effort send. Returns true if the provider accepted the message (or the
 * dev fallback logged it). Callers treat email failures as non-fatal so they
 * never leak whether an address exists.
 */
export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "TransTTS <onboarding@resend.dev>";

  if (!apiKey) {
    // Dev fallback: no provider configured. Log so the link is usable locally.
    console.warn(
      `[mail] RESEND_API_KEY not set — email not sent.\n  to: ${to}\n  subject: ${subject}\n  ${text}`
    );
    return true;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));

    if (!res.ok) {
      console.error("[mail] Resend rejected message:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] send failed:", err);
    return false;
  }
}

/** Build the email-OTP verification message for a 6-digit code. */
export function otpEmail(code: string): { subject: string; html: string; text: string } {
  const subject = "Your TransTTS verification code";
  const text =
    `Your TransTTS email verification code is: ${code}\n\n` +
    `It expires in 10 minutes. If you didn't request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p style="color:#444;line-height:1.6">Enter this code in TransTTS to verify your email address. It expires in <strong>10 minutes</strong>.</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:24px 0;color:#111">${code}</p>
      <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  return { subject, html, text };
}

/** Build the password-reset email body for a given reset URL. */
export function resetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  const subject = "Reset your TransTTS password";
  const text =
    `We received a request to reset your TransTTS password.\n\n` +
    `Reset it here (link expires in 1 hour):\n${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p style="color:#444;line-height:1.6">We received a request to reset your TransTTS password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#FF8000;color:#0a0a0a;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">Reset password</a>
      </p>
      <p style="color:#888;font-size:13px;line-height:1.6">If the button doesn't work, paste this link into your browser:<br>${resetUrl}</p>
      <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>`;
  return { subject, html, text };
}
