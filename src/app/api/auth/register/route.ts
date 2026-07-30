import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, createUserSession } from "@/lib/auth";
import { guard } from "@/lib/api-guard";

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
    // Upper bound caps scrypt work per request (DoS guard).
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: "Password must be 8–200 characters." }, { status: 400 });
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
      select: { id: true, email: true, name: true, role: true, image: true, provider: true },
    });

    await createUserSession({ sub: user.id, email: user.email, role: user.role, name: user.name });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
