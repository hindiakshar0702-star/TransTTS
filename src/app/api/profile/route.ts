import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { guard } from "@/lib/api-guard";

export const runtime = "nodejs";

/**
 * Profile self-service. A user may read and edit ONLY their own profile, and
 * only the non-authorization-bearing fields below. `email` (login identity),
 * `role` (privilege), and `provider` are intentionally NOT editable here — they
 * are never read from the request body, so a crafted payload cannot escalate
 * privilege or hijack another account's email.
 */

// Fields the client is allowed to return / send.
const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  provider: true,
  phone: true,
  jobTitle: true,
  organization: true,
  bio: true,
  defaultLang: true,
  defaultVoice: true,
} as const;

const LANG_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;
const VOICE_RE = /^[a-z]{2}(-[a-z]{2})?-(female|male)$/;
const PHONE_RE = /^[0-9+\-()\s]{3,30}$/;
// Cap the avatar payload so a giant base64 data-URL can't bloat the row / RAM.
const MAX_IMAGE_LEN = 3_000_000; // ~2MB binary once base64-decoded

/** Trim a string field, coerce empty → null, enforce a max length. */
function normStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined; // absent → leave unchanged
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// GET /api/profile — the current user's full editable profile.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: PROFILE_SELECT,
  });
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user: profile });
}

// PATCH /api/profile — update allowed profile fields for the current user.
export async function PATCH(req: NextRequest) {
  // CSRF + light abuse control (same-origin + per-IP window).
  const blocked = guard(req, "profile-update", { limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Build the update from the allow-list ONLY. Any other key (email/role/
  // provider/id/...) in the body is ignored by construction.
  const data: Record<string, string | null> = {};

  const name = normStr(body.name, 80);
  if (name !== undefined) {
    if (name === null) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    data.name = name;
  }

  const phone = normStr(body.phone, 30);
  if (phone !== undefined) {
    if (phone !== null && !PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    data.phone = phone;
  }

  const jobTitle = normStr(body.jobTitle, 80);
  if (jobTitle !== undefined) data.jobTitle = jobTitle;

  const organization = normStr(body.organization, 80);
  if (organization !== undefined) data.organization = organization;

  const bio = normStr(body.bio, 500);
  if (bio !== undefined) data.bio = bio;

  const defaultLang = normStr(body.defaultLang, 12);
  if (defaultLang !== undefined) {
    if (defaultLang !== null && !LANG_RE.test(defaultLang)) {
      return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
    }
    data.defaultLang = defaultLang;
  }

  const defaultVoice = normStr(body.defaultVoice, 40);
  if (defaultVoice !== undefined) {
    if (defaultVoice !== null && !VOICE_RE.test(defaultVoice)) {
      return NextResponse.json({ error: "Invalid voice." }, { status: 400 });
    }
    data.defaultVoice = defaultVoice;
  }

  // Avatar: accept an https URL or an inline data:image/* payload only.
  if (body.image !== undefined) {
    if (body.image === null || body.image === "") {
      data.image = null;
    } else if (typeof body.image === "string") {
      const img = body.image;
      if (img.length > MAX_IMAGE_LEN) {
        return NextResponse.json({ error: "Image too large. Maximum 2MB." }, { status: 400 });
      }
      const ok =
        /^https:\/\/[^\s]+$/.test(img) ||
        /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(img);
      if (!ok) {
        return NextResponse.json({ error: "Invalid image." }, { status: 400 });
      }
      data.image = img;
    } else {
      return NextResponse.json({ error: "Invalid image." }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: PROFILE_SELECT,
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Could not save profile. Please try again." }, { status: 500 });
  }
}
