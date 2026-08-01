import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { guard } from "@/lib/api-guard";
import { verifyOtp } from "@/lib/otp";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

const FAIL: Record<string, { msg: string; status: number }> = {
  no_code: { msg: "No active code. Request a new one.", status: 400 },
  expired: { msg: "Code expired. Request a new one.", status: 400 },
  too_many_attempts: { msg: "Too many wrong attempts. Request a new code.", status: 429 },
  invalid: { msg: "Incorrect code.", status: 400 },
};

export async function POST(req: NextRequest) {
  const blocked = guard(req, "otp-mobile-verify", { limit: 15, windowMs: 60_000 });
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!user.phone) {
    return NextResponse.json({ error: "No phone number on file. Request a code first." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const result = await verifyOtp({ userId: user.id, type: "MOBILE", code: parsed.data.code });
  if (!result.ok) {
    const f = FAIL[result.reason ?? "invalid"];
    return NextResponse.json(
      { error: f.msg, reason: result.reason, remaining: result.remaining },
      { status: f.status }
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  return NextResponse.json({ ok: true, phoneVerified: true });
}
