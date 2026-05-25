import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { synthesizeMp3, resolveVoice } from "@/lib/tts";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/tts/audio/[id]
 *
 * Streams the MP3 for a TTS job, regenerated deterministically from the
 * Job's stored `text` + `voice` columns. This makes the URL durable
 * across Vercel deployments and cold starts (BUG-002 root cause was a
 * disk-backed cache that vanished between function instances).
 *
 * `?download=1` switches the Content-Disposition to attachment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid audio id" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, type: true, text: true, voice: true, status: true },
    });

    if (!job || job.type !== "tts" || !job.text) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const audio = await synthesizeMp3(resolveVoice(job.voice), job.text);

    const download = req.nextUrl.searchParams.get("download") === "1";
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length.toString(),
      "Accept-Ranges": "bytes",
      // Audio is deterministic for a given (text, voice). Safe to cache
      // aggressively at the edge — if Job text/voice ever change, the
      // url's id changes too (different Job row).
      "Cache-Control": "public, max-age=86400, immutable",
    };

    headers["Content-Disposition"] = download
      ? `attachment; filename="speech-${job.id}.mp3"`
      : "inline";

    return new NextResponse(new Uint8Array(audio), { headers });
  } catch (error: unknown) {
    console.error("Audio serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve audio" },
      { status: 500 },
    );
  }
}
