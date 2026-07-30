import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

// GET /api/jobs — List the current user's jobs (admins see all).
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const type = req.nextUrl.searchParams.get("type");
    // Clamp pagination — reject NaN/negative/huge values.
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50") || 50));

    // Data isolation: a user only ever sees their own jobs. Admins see all.
    const scope = user.role === "admin" ? {} : { userId: user.id };
    const where = { ...scope, ...(type ? { type } : {}) };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    const stats = (await prisma.job.groupBy({
      by: ["type"],
      where: { ...scope, status: "completed" },
      _count: true,
    })) as unknown as Array<{ type: string; _count: number }>;

    const totalDuration = await prisma.job.aggregate({
      where: { ...scope, type: "transcribe", status: "completed" },
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

// DELETE /api/jobs — Clear history. A normal user clears only their own jobs;
// an admin clears everything. (Replaces the old ADMIN_SECRET_KEY header gate
// with a real session role check.)
export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "admin";
    const where = isAdmin ? {} : { userId: user.id };

    // Remove the audio files belonging to the jobs being deleted.
    const ttsJobs = await prisma.job.findMany({
      where: { ...where, type: "tts", audioUrl: { not: null } },
      select: { audioUrl: true },
    });
    const generatedDir = path.normalize(path.join(process.cwd(), "generated"));
    await Promise.all(
      ttsJobs.map(async (j) => {
        const fileId = j.audioUrl?.split("/").pop();
        if (fileId && /^[a-zA-Z0-9-]+$/.test(fileId)) {
          const filePath = path.normalize(path.join(generatedDir, `${fileId}.mp3`));
          // Path-traversal defense-in-depth.
          if (filePath.startsWith(generatedDir)) {
            await fs.unlink(filePath).catch(() => {});
          }
        }
      })
    );

    await prisma.job.deleteMany({ where });
    return NextResponse.json({ message: isAdmin ? "All jobs cleared" : "Your history was cleared" });
  } catch (error: unknown) {
    console.error("Clear jobs error:", error);
    return NextResponse.json({ error: "Failed to clear jobs" }, { status: 500 });
  }
}
