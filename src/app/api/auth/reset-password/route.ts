import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { hashPassword, bumpTokenVersion } from "@/lib/auth";
import { hashResetToken } from "@/lib/reset-token";
import { validatePassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "auth-reset-password", { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  try {
    const { token, password } = await req.json();

    if (typeof token !== "string" || typeof password !== "string" || !token) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    }

    const pw = validatePassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.errors[0], errors: pw.errors }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    // One generic error for every failure mode (unknown / used / expired token).
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    // Atomically: set the new password, mark the token used, and revoke every
    // existing session for the account (bumpTokenVersion). Order matters only in
    // that all must succeed together.
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await bumpTokenVersion(record.userId);

    return NextResponse.json({ message: "Password updated. Please sign in with your new password." });
  } catch (error) {
    console.error("Reset-password error:", error);
    return NextResponse.json({ error: "Could not reset password. Please try again." }, { status: 500 });
  }
}
