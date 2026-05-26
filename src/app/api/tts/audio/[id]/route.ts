import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import fs from "fs";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/tts/audio/[id]
 *
 * Streams a TTS-generated MP3 by re-synthesising deterministically
 * from the stored `text` + `voice` columns of the matching Job row.
 * Used by:
 *   - The dashboard "▶" button (older jobs)
 *   - The download (?download=1) link
 *
 * If the database isn't configured, this route 404s — that's fine,
 * because the inline data URL returned by POST /api/tts already
 * covers the playback case for fresh generations.
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

    const db = getPrisma();
    if (!db) {
      // No DB → can't look up the job, but we don't want to crash.
      return NextResponse.json(
        { error: "Audio history is unavailable (DB not configured)." },
        { status: 503 },
      );
    }

    const job = await db.job.findUnique({
      where: { id },
      select: { id: true, type: true, text: true, voice: true },
    });

    if (!job || job.type !== "tts" || !job.text) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const msVoice = job.voice || "hi-IN-SwaraNeural";
    const audio = await synthesize(msVoice, job.text);

    const download = req.nextUrl.searchParams.get("download") === "1";
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length.toString(),
      "Accept-Ranges": "bytes",
      // Audio is deterministic for a given (text, voice) pair → safe
      // to cache aggressively at the edge.
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

async function synthesize(msVoice: string, text: string): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `tts-${randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(msVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    await tts.toFile(tmpDir, text);
    const filePath = path.join(tmpDir, "audio.mp3");
    if (!fs.existsSync(filePath)) {
      throw new Error("TTS engine did not produce an audio file");
    }
    return fs.readFileSync(filePath);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
