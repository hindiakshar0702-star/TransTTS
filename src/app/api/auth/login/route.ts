import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, createUserSession } from "@/lib/auth";
import { guard } from "@/lib/api-guard";

export const runtime = "nodejs";

// A well-formed but non-matching hash. When the email is unknown we still run a
// full scrypt comparison against this so response timing does not reveal whether
// the account exists (user-enumeration defense). 32-hex salt + 128-hex key
// (= 64 bytes, matching the real derived-key length).
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

export async function POST(req: NextRequest) {
  // Brute-force guard on login.
  const blocked = guard(req, "auth-login", { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  try {
    const { email, password } = await req.json();

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const normEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normEmail } });

    // Always run a hash comparison (real hash, or dummy) to keep timing uniform.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    // Same generic error for: unknown email, OAuth-only account (no password),
    // or wrong password — never leak which.
    if (!user || !user.passwordHash || !ok) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await createUserSession({
      sub: user.id, email: user.email, role: user.role, name: user.name, tv: user.tokenVersion,
    });
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
