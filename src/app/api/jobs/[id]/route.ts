import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

/** True when the user owns the job or is an admin. */
function canAccess(job: { userId: string | null }, user: { id: string; role: string }): boolean {
  return job.userId === user.id || user.role === "admin";
}

// GET /api/jobs/[id] — Get a single job (owner or admin only).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const job = await prisma.job.findUnique({ where: { id } });
    // 404 (not 403) for non-owned jobs so existence is never leaked.
    if (!job || !canAccess(job, user)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

// DELETE /api/jobs/[id] — Delete a single job (owner or admin only).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || !canAccess(job, user)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Clean up the associated audio file for TTS jobs.
    if (job.type === "tts" && job.audioUrl) {
      const fileId = job.audioUrl.split("/").pop();
      if (fileId && /^[a-zA-Z0-9-]+$/.test(fileId)) {
        const generatedDir = path.normalize(path.join(process.cwd(), "generated"));
        const filePath = path.normalize(path.join(generatedDir, `${fileId}.mp3`));
        // Path-traversal defense-in-depth.
        if (filePath.startsWith(generatedDir)) {
          try {
            await fs.unlink(filePath);
          } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
              console.error(`Failed to delete orphaned audio file at ${filePath}:`, err);
            }
          }
        }
      }
    }

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ message: "Job deleted" });
  } catch (error) {
    console.error("Delete job error:", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
