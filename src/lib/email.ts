/**
 * Lightweight email sender via Resend's REST API.
 *
 * Why fetch and not the `resend` npm package?
 *   - Zero new dependencies
 *   - Resend's API is a single POST — no SDK gymnastics needed
 *   - Easier to swap to another provider later (just replace this file)
 *
 * If RESEND_API_KEY is not configured, sendEmail() returns
 * { sent: false, skipped: true } — callers should treat email as
 * best-effort: never block a successful DB write on email delivery.
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Override the global FROM_EMAIL for this send only. */
  from?: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = input.from || process.env.FROM_EMAIL;

  if (!apiKey || !fromAddr) {
    console.warn(
      "[email] Skipping send — RESEND_API_KEY or FROM_EMAIL not configured"
    );
    return { sent: false, skipped: true, error: "Email not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddr,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg = `Resend HTTP ${res.status}: ${body.slice(0, 200)}`;
      console.error("[email] Send failed", msg);
      return { sent: false, error: msg };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error";
    console.error("[email] Send threw", msg);
    return { sent: false, error: msg };
  }
}

/* -------------------------------------------------------------------- */
/* Helpers — small HTML-safe utilities so callers don't have to think    */
/* about XSS in subject / body interpolation.                            */
/* -------------------------------------------------------------------- */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds a plain-text version of an HTML message by stripping tags.
 * Good enough for transactional emails where we control the HTML.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
