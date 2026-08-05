import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
// Always execute — a cached health check tells the platform nothing.
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for the hosting platform.
 *
 * Reports "ok" only when the database actually answers, so a deploy with a bad
 * DATABASE_URL fails its health check instead of serving broken pages. The
 * response is deliberately free of version, host and error detail — this
 * endpoint is public.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "up" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[health] database check failed:", error);
    return NextResponse.json(
      { status: "degraded", database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
