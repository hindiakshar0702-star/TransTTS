import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getSessionUser,
  verifyPassword,
  hashPassword,
  bumpTokenVersion,
} from "@/lib/auth";
import { guard } from "@/lib/api-guard";
import { validatePassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Rate-limit + same-origin (CSRF) guard.
  const blocked = guard(req, "auth-change-password", { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
    }

    // Load the hash for the authenticated user only.
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, role: true, name: true, passwordHash: true },
    });

    // OAuth-only accounts have no local password to change.
    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "This account has no password. Use the password-reset flow to set one." },
        { status: 400 }
      );
    }

    const currentOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentOk) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const pw = validatePassword(newPassword, user.email);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.errors[0], errors: pw.errors }, { status: 400 });
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current one." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Revoke every existing session (including this device — the current
    // Auth.js JWT's tokenVersion is now stale). The client re-establishes THIS
    // device's session via signIn("credentials") with the new password.
    await bumpTokenVersion(user.id);

    return NextResponse.json({ ok: true, email: user.email });
  } catch (error) {
    console.error("Change-password error:", error);
    return NextResponse.json({ error: "Could not change password. Please try again." }, { status: 500 });
  }
}
