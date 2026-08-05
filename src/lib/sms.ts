/**
 * SMS sender with a transport priority chain:
 *   1. Android phone SMS gateway (SMS_GATEWAY_URL) — the free "own SIM" path.
 *      Targets the capcom6/android-sms-gateway local API shape:
 *      POST {url}/message, optional Basic auth, JSON {message, phoneNumbers[]}.
 *      DEV/low-volume only — phone must stay online; carriers may block bulk.
 *   2. Twilio REST API (TWILIO_ACCOUNT_SID / _AUTH_TOKEN / _FROM_NUMBER).
 *   3. Dev fallback: log to the server console.
 *
 * An India deployment can swap in MSG91 the same way without touching callers.
 * Node-only. Never import from middleware.
 */

export const runtime = "nodejs";

async function sendViaGateway(to: string, body: string): Promise<boolean> {
  const base = process.env.SMS_GATEWAY_URL!.replace(/\/$/, "");
  const user = process.env.SMS_GATEWAY_USER;
  const pass = process.env.SMS_GATEWAY_PASS;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user && pass) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(`${base}/message`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: body, phoneNumbers: [to] }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      console.error("[sms] gateway rejected message:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sms] gateway send failed:", err);
    return false;
  }
}

/**
 * Best-effort send. Returns true if a transport accepted the message (or the dev
 * fallback logged it). SMS failures are treated as non-fatal by callers.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  // 1. Android phone gateway (own SIM, free-ish, dev).
  if (process.env.SMS_GATEWAY_URL) {
    return sendViaGateway(to, body);
  }

  // 2. Twilio.
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && from) {
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

  // 3. Dev fallback.
  console.warn(`[sms] no transport configured (SMS_GATEWAY_URL or TWILIO_*) — SMS not sent.\n  to: ${to}\n  ${body}`);
  return true;
}

/** SMS body for a 6-digit verification code. */
export function otpSms(code: string): string {
  return `${code} is your TransTTS verification code. It expires in 10 minutes. Do not share it.`;
}
