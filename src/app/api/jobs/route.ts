import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/jobs — List all jobs
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

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

    // Stats
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
      pages: Math.ceil(total / limit),
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

// DELETE /api/jobs — Clear all jobs
export async function DELETE() {
  try {
    await prisma.job.deleteMany();
    return NextResponse.json({ message: "All jobs cleared" });
  } catch (error: unknown) {
    console.error("Clear jobs error:", error);
    return NextResponse.json({ error: "Failed to clear jobs" }, { status: 500 });
  }
}
