import { NextRequest, NextResponse } from "next/server";
import { clearUserSession } from "@/lib/auth";
import { checkOrigin } from "@/lib/api-guard";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // CSRF guard: a state-changing request must come from our own pages.
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  await clearUserSession();
  return NextResponse.json({ ok: true });
}
