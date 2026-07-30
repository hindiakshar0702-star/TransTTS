import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID pattern to prevent Path Traversal
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid audio ID format" }, { status: 400 });
    }

    const generatedDir = path.normalize(path.join(process.cwd(), "generated"));
    const filePath = path.normalize(path.join(generatedDir, `${id}.mp3`));

    // Verify path traversal defense-in-depth
    if (!filePath.startsWith(generatedDir)) {
      return NextResponse.json({ error: "Invalid audio ID format" }, { status: 400 });
    }

    // Ownership check: only the owning user (or an admin) may fetch the audio.
    // Same-origin <audio>/download requests carry the session cookie.
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const job = await prisma.job.findFirst({
      where: { audioUrl: `/api/tts/audio/${id}` },
      select: { userId: true },
    });
    if (!job || (job.userId !== user.id && user.role !== "admin")) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);

    // Check if download is requested via query param
    const download = req.nextUrl.searchParams.get("download") === "1";

    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Content-Length": fileBuffer.length.toString(),
      "Accept-Ranges": "bytes",
      // Per-user resource — never cache in shared/proxy caches.
      "Cache-Control": "private, max-age=86400",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="speech-${id}.mp3"`;
    } else {
      headers["Content-Disposition"] = "inline";
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error: unknown) {
    console.error("Audio serve error:", error);
    return NextResponse.json({ error: "Failed to serve audio" }, { status: 500 });
  }
}
