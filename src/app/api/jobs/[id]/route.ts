import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

// GET /api/jobs/[id] — Get single job
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

// DELETE /api/jobs/[id] — Delete single job
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Admin token check — FAIL CLOSED (see /api/jobs DELETE).
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) {
      return NextResponse.json({ error: "Admin operations are not configured." }, { status: 503 });
    }
    if (req.headers.get("x-admin-token") !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Retrieve the job to see if we need to clean up its audio file
    const job = await prisma.job.findUnique({ where: { id } });
    if (job && job.type === "tts" && job.audioUrl) {
      const fileId = job.audioUrl.split("/").pop();
      if (fileId && /^[a-zA-Z0-9-]+$/.test(fileId)) {
        const generatedDir = path.normalize(path.join(process.cwd(), "generated"));
        const filePath = path.normalize(path.join(generatedDir, `${fileId}.mp3`));
        
        // Verify path traversal defense-in-depth
        if (filePath.startsWith(generatedDir)) {
          // Safely try unlinking the file
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
