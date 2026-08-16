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
    const total = fileBuffer.length;

    // Download requested via query param.
    const download = req.nextUrl.searchParams.get("download") === "1";

    const baseHeaders: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      // Per-user resource — never cache in shared/proxy caches.
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": download ? `attachment; filename="speech-${id}.mp3"` : "inline",
    };

    // Honour a Range request so <audio> seeking works and the Accept-Ranges
    // advertised above is truthful. Only the single-range `bytes=start-end`
    // form is handled; anything malformed falls through to the full 200.
    const range = req.headers.get("range");
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match && !download) {
      const startRaw = match[1];
      const endRaw = match[2];
      // Suffix form "bytes=-N" = the last N bytes.
      let start = startRaw === "" ? total - Number(endRaw) : Number(startRaw);
      let end = endRaw === "" || startRaw === "" ? total - 1 : Number(endRaw);
      start = Math.max(0, start);
      end = Math.min(end, total - 1);

      if (start > end || Number.isNaN(start) || Number.isNaN(end)) {
        return new NextResponse(null, {
          status: 416, // Range Not Satisfiable
          headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" },
        });
      }

      const chunk = fileBuffer.subarray(start, end + 1);
      return new NextResponse(chunk, {
        status: 206, // Partial Content
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": chunk.length.toString(),
        },
      });
    }

    return new NextResponse(fileBuffer, {
      headers: { ...baseHeaders, "Content-Length": total.toString() },
    });
  } catch (error: unknown) {
    console.error("Audio serve error:", error);
    return NextResponse.json({ error: "Failed to serve audio" }, { status: 500 });
  }
}
