import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import prisma from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { getGeneratedDir } from "@/lib/server-utils";
import { guard } from "@/lib/api-guard";
import { getSessionUser } from "@/lib/auth";
import { maybeSweepMedia } from "@/lib/media-cleanup";
import fs from "fs/promises";
import path from "path";

const VOICES = new Map<string, string>([
  ["hi-female", "hi-IN-SwaraNeural"],
  ["hi-male", "hi-IN-MadhurNeural"],
  ["en-female", "en-US-JennyNeural"],
  ["en-male", "en-US-GuyNeural"],
  ["en-uk-female", "en-GB-SoniaNeural"],
  ["en-uk-male", "en-GB-RyanNeural"],
  ["es-female", "es-ES-ElviraNeural"],
  ["fr-female", "fr-FR-DeniseNeural"],
  ["de-female", "de-DE-KatjaNeural"],
  ["ja-female", "ja-JP-NanamiNeural"],
  ["ko-female", "ko-KR-SunHiNeural"],
  ["ar-male", "ar-SA-HamedNeural"],
  ["pt-female", "pt-BR-FranciscaNeural"],
  ["bn-female", "bn-IN-TanishaaNeural"],
  ["ta-female", "ta-IN-PallaviNeural"],
  ["te-female", "te-IN-ShrutiNeural"],
  ["mr-female", "mr-IN-AarohiNeural"],
  ["gu-female", "gu-IN-DhwaniNeural"],
  ["ur-male", "ur-PK-AsadNeural"],
]);

export async function POST(req: NextRequest) {
  let jobId: string | null = null;

  const blocked = guard(req, "tts", { limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Opportunistic disk housekeeping — throttled internally to once an hour and
  // never awaited, so it adds nothing to this request's latency.
  maybeSweepMedia();

  try {
    const { text, voice, speed } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long. Maximum 5000 characters." }, { status: 400 });
    }

    // Clamp speed to the slider's allowed range; ignore non-numeric input
    const rate =
      typeof speed === "number" && isFinite(speed)
        ? Math.min(2.0, Math.max(0.5, speed))
        : 1.0;

    const msVoice = (typeof voice === "string" && VOICES.has(voice))
      ? (VOICES.get(voice) as string)
      : (VOICES.get("hi-female") as string);

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        userId: sessionUser.id,
        type: "tts",
        title: text.substring(0, 80),
        status: "processing",
        text: text.substring(0, 2000),
        voice: msVoice,
      },
    });
    jobId = job.id;

    const generatedDir = getGeneratedDir();
    const fileId = generateId();
    const tempDir = path.normalize(path.join(generatedDir, fileId));
    
    // Verify path traversal defense-in-depth
    if (!tempDir.startsWith(generatedDir)) {
      return NextResponse.json({ error: "Invalid generated directory path" }, { status: 400 });
    }
    
    await fs.mkdir(tempDir, { recursive: true });

    const tts = new MsEdgeTTS();
    await tts.setMetadata(msVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    await tts.toFile(tempDir, text, { rate });

    const generatedFile = path.normalize(path.join(tempDir, "audio.mp3"));
    const finalPath = path.normalize(path.join(generatedDir, `${fileId}.mp3`));

    // Verify path traversal defense-in-depth
    if (!generatedFile.startsWith(tempDir) || !finalPath.startsWith(generatedDir)) {
      return NextResponse.json({ error: "Invalid file paths" }, { status: 400 });
    }

    const fileExists = await fs.access(generatedFile).then(() => true).catch(() => false);
    if (fileExists) {
      await fs.rename(generatedFile, finalPath);
      try { await fs.rmdir(tempDir); } catch { /* ignore */ }
    } else {
      throw new Error("Audio file was not generated");
    }

    const audioUrl = `/api/tts/audio/${fileId}`;

    // Save to DB
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "completed", progress: 100, audioUrl },
    });

    return NextResponse.json({
      id: fileId,
      audioUrl,
      voice: msVoice,
      textLength: text.length,
    });
  } catch (error: unknown) {
    console.error("TTS error:", error);
    const raw = error instanceof Error ? error.message : "";

    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "error", errorMsg: raw || "TTS generation failed" },
      }).catch(() => {});
    }

    // Generic message to the client; full detail is logged / stored server-side.
    return NextResponse.json({ error: "Voice generation failed. Please try again." }, { status: 500 });
  }
}
