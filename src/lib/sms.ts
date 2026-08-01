/**
 * Minimal, dependency-free SMS sender. Uses the Twilio REST API when configured
 * (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER); otherwise logs
 * to the server console so local/dev + test flows work without a real provider.
 *
 * Twilio chosen over MSG91 for the default: a single Basic-auth POST (no SDK,
 * matching mail.ts's Resend pattern) and first-class test creds/magic numbers.
 * An India deployment can swap this transport for MSG91 without touching callers.
 *
 * Node-only. Never import from middleware.
 */

export const runtime = "nodejs";

/**
 * Best-effort send. Returns true if Twilio accepted the message (or the dev
 * fallback logged it). SMS failures are treated as non-fatal by callers.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.warn(`[sms] Twilio not configured — SMS not sent.\n  to: ${to}\n  ${body}`);
    return true;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));

    if (!res.ok) {
      console.error("[sms] Twilio rejected message:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sms] send failed:", err);
    return false;
  }
}

/** SMS body for a 6-digit verification code. */
export function otpSms(code: string): string {
  return `${code} is your TransTTS verification code. It expires in 10 minutes. Do not share it.`;
}
