import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  sendEmail,
  isEmailConfigured,
  escapeHtml,
  htmlToText,
} from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* -------------------------------------------------------------------- */
/* Config                                                                */
/* -------------------------------------------------------------------- */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const NAME_MAX = 120;
const EMAIL_MAX = 200;
const COMPANY_MAX = 200;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 4000;
const ALLOWED_TEAM_SIZES = new Set([
  "",
  "1-5",
  "6-20",
  "21-50",
  "51-100",
  "100+",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------------------------------------------- */
/* POST /api/contact — submit form                                       */
/* -------------------------------------------------------------------- */

interface ContactBody {
  name?: string;
  email?: string;
  company?: string;
  teamSize?: string;
  message?: string;
  /** Honeypot — if filled, it's almost certainly a bot. */
  website?: string;
}

export async function POST(req: NextRequest) {
  // 1. Rate limit by IP — prevents form-spam floods
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`contact:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Too many requests. Try again in ${Math.ceil(
          rl.retryAfterSeconds / 60
        )} minutes.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rl.retryAfterSeconds.toString(),
          "X-RateLimit-Limit": RATE_LIMIT_MAX.toString(),
          "X-RateLimit-Remaining": rl.remaining.toString(),
        },
      }
    );
  }

  // 2. Parse body
  let body: ContactBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // 3. Honeypot — bots love to fill any input they see. Humans don't see this
  //    field (CSS hides it visually). If filled, return 200 silently so the
  //    bot thinks it succeeded but we drop the submission.
  if (body.website && body.website.trim() !== "") {
    console.warn(`[contact] Honeypot triggered from ip=${ip}`);
    return NextResponse.json({ ok: true, queued: true });
  }

  // 4. Validate
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const company = (body.company || "").trim();
  const teamSize = (body.teamSize || "").trim();
  const message = (body.message || "").trim();

  if (!name || name.length > NAME_MAX) {
    return NextResponse.json(
      { error: "Please enter a valid name." },
      { status: 400 }
    );
  }
  if (!email || email.length > EMAIL_MAX || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  if (company && company.length > COMPANY_MAX) {
    return NextResponse.json(
      { error: "Company name is too long." },
      { status: 400 }
    );
  }
  if (!ALLOWED_TEAM_SIZES.has(teamSize)) {
    return NextResponse.json(
      { error: "Invalid team size selection." },
      { status: 400 }
    );
  }
  if (!message || message.length < MESSAGE_MIN) {
    return NextResponse.json(
      { error: `Please write at least ${MESSAGE_MIN} characters in your message.` },
      { status: 400 }
    );
  }
  if (message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message is too long (max ${MESSAGE_MAX} characters).` },
      { status: 400 }
    );
  }

  // 5. Persist FIRST — emails are best-effort, the lead must never be lost.
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
  const referrer = req.headers.get("referer")?.slice(0, 500) || null;

  const inquiry = await prisma.contactInquiry.create({
    data: {
      name,
      email,
      company: company || null,
      teamSize: teamSize || null,
      message,
      source: "contact_page",
      ipAddress: ip,
      userAgent,
      referrer,
    },
  });

  // 6. Send notifications — fire-and-track but don't fail the request if
  //    email delivery is broken. The DB row is the source of truth.
  if (isEmailConfigured()) {
    try {
      await Promise.all([
        sendAdminNotification(inquiry.id, {
          name,
          email,
          company,
          teamSize,
          message,
          ip,
          userAgent: userAgent || "",
        }),
        sendUserAutoReply({ name, email }),
      ]);
    } catch (err) {
      // Errors are already logged + recorded inside the helpers
      console.warn("[contact] email pipeline error", err);
    }
  }

  return NextResponse.json({
    ok: true,
    id: inquiry.id,
  });
}

/* -------------------------------------------------------------------- */
/* GET /api/contact — admin list (gated by ADMIN_TOKEN)                  */
/* -------------------------------------------------------------------- */

/**
 * GET /api/contact?token=<ADMIN_TOKEN>&limit=50
 *
 * Tiny operator endpoint so the form can be tested without spinning up
 * Prisma Studio. Returns the most recent inquiries.
 *
 * Security: requires ADMIN_TOKEN env var to be set, and the request to
 * pass the same value via ?token= or X-Admin-Token header. Never gate
 * with a hardcoded password and never enable this without a token.
 */
export async function GET(req: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "Admin endpoint not configured (set ADMIN_TOKEN env var)." },
      { status: 503 }
    );
  }

  const provided =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-admin-token") ||
    "";

  if (provided !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(
    200,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50)
  );

  const inquiries = await prisma.contactInquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    count: inquiries.length,
    items: inquiries,
  });
}

/* -------------------------------------------------------------------- */
/* Email helpers                                                          */
/* -------------------------------------------------------------------- */

interface AdminNotificationData {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  message: string;
  ip: string;
  userAgent: string;
}

async function sendAdminNotification(
  inquiryId: string,
  d: AdminNotificationData
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[contact] ADMIN_EMAIL not set, skipping admin notification");
    return;
  }

  const html = `
    <h2 style="margin:0 0 12px;font-family:system-ui,sans-serif">📬 New Contact Form Submission</h2>
    <p style="color:#555;margin:0 0 24px;font-family:system-ui,sans-serif">
      A new inquiry just landed in TransTTS — reply within 24h to honour the SLA on the contact page.
    </p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="color:#666"><strong>Name</strong></td><td>${escapeHtml(d.name)}</td></tr>
      <tr><td style="color:#666"><strong>Email</strong></td><td><a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a></td></tr>
      ${d.company ? `<tr><td style="color:#666"><strong>Company</strong></td><td>${escapeHtml(d.company)}</td></tr>` : ""}
      ${d.teamSize ? `<tr><td style="color:#666"><strong>Team size</strong></td><td>${escapeHtml(d.teamSize)}</td></tr>` : ""}
      <tr><td style="color:#666;vertical-align:top"><strong>Message</strong></td><td><div style="white-space:pre-wrap;background:#f6f6f8;padding:12px;border-radius:6px;border:1px solid #eee">${escapeHtml(d.message)}</div></td></tr>
      <tr><td style="color:#666"><strong>Inquiry&nbsp;ID</strong></td><td><code>${escapeHtml(inquiryId)}</code></td></tr>
      <tr><td style="color:#666"><strong>IP</strong></td><td><code>${escapeHtml(d.ip)}</code></td></tr>
      ${d.userAgent ? `<tr><td style="color:#666;vertical-align:top"><strong>User agent</strong></td><td style="font-size:12px;color:#999">${escapeHtml(d.userAgent)}</td></tr>` : ""}
    </table>
    <p style="margin-top:24px;font-family:system-ui,sans-serif;font-size:12px;color:#999">
      Replying to this email goes directly to <strong>${escapeHtml(d.email)}</strong>.
    </p>
  `.trim();

  const result = await sendEmail({
    to: adminEmail,
    subject: `📬 New contact: ${d.name}${d.company ? ` (${d.company})` : ""}`,
    html,
    text: htmlToText(html),
    replyTo: d.email,
  });

  await prisma.contactInquiry.update({
    where: { id: inquiryId },
    data: {
      notificationEmailSent: result.sent,
      ...(result.error ? { emailError: result.error } : {}),
    },
  });
}

async function sendUserAutoReply(d: {
  name: string;
  email: string;
}): Promise<void> {
  // Some operators may want to disable user auto-replies (e.g. while polishing
  // the copy). The presence of FROM_EMAIL gates the entire pipeline already,
  // so we simply send if email is configured.

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 12px">Hi ${escapeHtml(d.name.split(" ")[0])} 👋</h2>
      <p style="color:#444;font-size:15px;line-height:1.6">
        Thanks for reaching out to <strong>TransTTS AI</strong>. We&rsquo;ve received
        your enquiry and a teammate will reply <strong>within 24 hours</strong>
        (Mon&ndash;Fri, IST).
      </p>
      <p style="color:#444;font-size:15px;line-height:1.6">
        While you wait, you can:
      </p>
      <ul style="color:#444;font-size:15px;line-height:1.7">
        <li>Try the live transcription &rarr; <a href="https://trans-tts.app/transcribe">trans-tts.app/transcribe</a></li>
        <li>Browse plans &amp; pricing &rarr; <a href="https://trans-tts.app/pricing">trans-tts.app/pricing</a></li>
      </ul>
      <p style="color:#444;font-size:15px;line-height:1.6;margin-top:24px">
        — Team TransTTS<br/>
        <span style="color:#999;font-size:13px">Made with ❤️ in India</span>
      </p>
    </div>
  `.trim();

  await sendEmail({
    to: d.email,
    subject: "We got your message — TransTTS AI",
    html,
    text: htmlToText(html),
  });
}
