import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { guard } from "@/lib/api-guard";
import { validatePassword } from "@/lib/password";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Brute-force / spam guard on account creation.
  const blocked = guard(req, "auth-register", { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  try {
    const { email, password, name } = await req.json();

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const normEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normEmail) || normEmail.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    // Enforce the shared password policy (length + complexity + blocklist). The
    // upper length bound also caps scrypt work per request (DoS guard).
    const pw = validatePassword(password, normEmail);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.errors[0], errors: pw.errors }, { status: 400 });
    }
    const safeName =
      typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : null;

    // Existence check only — never load the password hash into memory here.
    const existing = await prisma.user.findUnique({
      where: { email: normEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: normEmail, name: safeName, passwordHash, provider: "credentials" },
      select: {
        id: true, email: true, name: true, role: true,
        image: true, provider: true,
      },
    });

    // Session is established by Auth.js: the client calls signIn("credentials")
    // right after a 201 here. (Register only creates the account.)
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
