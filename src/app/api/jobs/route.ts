import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

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
    const stats = (await prisma.job.groupBy({
      by: ["type"],
      where: { status: "completed" },
      _count: true,
    })) as unknown as Array<{ type: string; _count: number }>;

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
export async function DELETE(req: NextRequest) {
  try {
    // Optional Admin Token check
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (adminSecret) {
      const token = req.headers.get("x-admin-token");
      if (token !== adminSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Clean up physical audio files from the generated directory
    const generatedDir = path.normalize(path.join(/*turbopackIgnore: true*/ process.cwd(), "generated"));
    const dirExists = await fs.access(generatedDir).then(() => true).catch(() => false);
    if (dirExists) {
      const files = await fs.readdir(generatedDir);
      await Promise.all(
        files.map(async (file) => {
          if (file.endsWith(".mp3")) {
            const filePath = path.normalize(path.join(generatedDir, file));
            if (filePath.startsWith(generatedDir)) {
              try {
                await fs.unlink(filePath);
              } catch (err) {
                console.error(`Failed to delete file ${file}:`, err);
              }
            }
          }
        })
      );
    }

    await prisma.job.deleteMany();
    return NextResponse.json({ message: "All jobs cleared" });
  } catch (error: unknown) {
    console.error("Clear jobs error:", error);
    return NextResponse.json({ error: "Failed to clear jobs" }, { status: 500 });
  }
}
