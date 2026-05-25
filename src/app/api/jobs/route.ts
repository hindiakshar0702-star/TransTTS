import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * Job types we expose. Anything outside this set is treated as
 * "no filter" — never passed unsanitised into Prisma.
 */
const ALLOWED_TYPES = new Set(["transcribe", "translate", "tts"] as const);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/** Parse a positive integer from an unknown input, with bounds. */
function parsePositiveInt(
  raw: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
  min = 1,
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/* -------------------------------------------------------------------- */
/* GET /api/jobs — list + stats                                         */
/* -------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const rawType = req.nextUrl.searchParams.get("type");
    const type =
      rawType && (ALLOWED_TYPES as Set<string>).has(rawType) ? rawType : null;

    const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(
      req.nextUrl.searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    const where = type ? { type } : {};

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    // Stats are global on purpose — same for every page request.
    const stats = await prisma.job.groupBy({
      by: ["type"],
      where: { status: "completed" },
      _count: true,
    });

    const totalDuration = await prisma.job.aggregate({
      where: { type: "transcribe", status: "completed" },
      _sum: { duration: true },
    });

    return NextResponse.json({
      jobs,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total,
        transcriptions: stats.find((s) => s.type === "transcribe")?._count || 0,
        translations: stats.find((s) => s.type === "translate")?._count || 0,
        ttsGenerations: stats.find((s) => s.type === "tts")?._count || 0,
        totalMinutes: (totalDuration._sum.duration || 0) / 60,
      },
    });
  } catch (error: unknown) {
    console.error("Jobs list error:", error);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

/* -------------------------------------------------------------------- */
/* DELETE /api/jobs — clear ALL jobs (operator-only)                    */
/* -------------------------------------------------------------------- */

/**
 * Wipes the entire jobs table. ALWAYS requires an admin token — this is
 * the most destructive endpoint in the app and was previously open to
 * the public internet.
 *
 * If `ADMIN_TOKEN` is not configured, the endpoint returns 503 (not 401)
 * to make the misconfiguration loud.
 */
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const result = await prisma.job.deleteMany();
    return NextResponse.json({
      message: "All jobs cleared",
      deleted: result.count,
    });
  } catch (error: unknown) {
    console.error("Clear jobs error:", error);
    return NextResponse.json({ error: "Failed to clear jobs" }, { status: 500 });
  }
}
