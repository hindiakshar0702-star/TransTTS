import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { newResetToken, RESET_TOKEN_TTL_MS } from "@/lib/reset-token";
import { sendMail, resetEmail } from "@/lib/mail";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deliberately generic — never reveals whether an account exists.
const GENERIC_OK = {
  message: "If an account exists for that email, a reset link is on its way.",
};

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  // Tight limit: reset requests trigger email + DB writes and are a spam vector.
  const blocked = guard(req, "auth-request-reset", { limit: 5, windowMs: 60_000 });
  if (blocked) return blocked;

  try {
    const { email } = await req.json();
    if (typeof email !== "string") return NextResponse.json(GENERIC_OK);

    const normEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normEmail) || normEmail.length > 254) {
      return NextResponse.json(GENERIC_OK); // still generic — no enumeration
    }

    // Only credentials accounts with a password can be reset. OAuth-only users
    // have no local password, so we silently no-op (same generic response).
    const user = await prisma.user.findUnique({
      where: { email: normEmail },
      select: { id: true, passwordHash: true },
    });

    if (user?.passwordHash) {
      // Invalidate any outstanding tokens for this user, then mint a fresh one.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const { raw, hash } = newResetToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${getBaseUrl(req)}/reset-password?token=${raw}`;
      const body = resetEmail(resetUrl);
      // Fire-and-forget-ish: email failures are non-fatal and must not change the
      // response (which would leak account existence).
      await sendMail({ to: normEmail, ...body });
    }

    return NextResponse.json(GENERIC_OK);
  } catch (error) {
    console.error("Request-reset error:", error);
    // Even on error, stay generic.
    return NextResponse.json(GENERIC_OK);
  }
}
