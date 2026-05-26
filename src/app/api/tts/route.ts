import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import fs from "fs";
import { tryDbWrite } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/tts
 *
 * Generates Microsoft Neural TTS audio and returns it INLINE as a
 * base64 data URL. This means:
 *
 *   1. The audio plays instantly on the client (just `<audio src=…>`).
 *   2. We don't need a writable disk between requests (Vercel function
 *      instances each have their own ephemeral /tmp; a URL pointing at
 *      one instance's tmp dir 404s when served by another).
 *   3. We don't need a working database — if Prisma is misconfigured,
 *      the audio still arrives and the only loss is the optional history
 *      row in the dashboard.
 *
 * Trade-off: data URLs inflate ~33% via base64 — a typical 5,000-char
 * synthesis is ~150-300 KB which is well under any practical JSON limit.
 *
 * The companion route `/api/tts/audio/[id]` still works for older
 * history rows that point at it — but new generations no longer rely
 * on it being readable.
 */

const VOICES: Record<string, string> = {
  "hi-female": "hi-IN-SwaraNeural",
  "hi-male": "hi-IN-MadhurNeural",
  "en-female": "en-US-JennyNeural",
  "en-male": "en-US-GuyNeural",
  "en-uk-female": "en-GB-SoniaNeural",
  "en-uk-male": "en-GB-RyanNeural",
  "es-female": "es-ES-ElviraNeural",
  "fr-female": "fr-FR-DeniseNeural",
  "de-female": "de-DE-KatjaNeural",
  "ja-female": "ja-JP-NanamiNeural",
  "ko-female": "ko-KR-SunHiNeural",
  "ar-male": "ar-SA-HamedNeural",
  "pt-female": "pt-BR-FranciscaNeural",
  "bn-female": "bn-IN-TanishaaNeural",
  "ta-female": "ta-IN-PallaviNeural",
  "te-female": "te-IN-ShrutiNeural",
  "mr-female": "mr-IN-AarohiNeural",
  "gu-female": "gu-IN-DhwaniNeural",
  "ur-male": "ur-PK-AsadNeural",
};
const DEFAULT_VOICE = VOICES["hi-female"];
const MAX_TEXT = 5000;

/**
 * Run msedge-tts in a transient `/tmp` workspace and return the
 * synthesised MP3 as an in-memory Buffer. Cleans up after itself
 * even on failure.
 */
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
      /* ignore cleanup errors */
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { text, voice } = body as { text?: unknown; voice?: unknown };

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    if (text.length > MAX_TEXT) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${MAX_TEXT} characters.` },
        { status: 400 },
      );
    }

    const requested = typeof voice === "string" ? voice : "";
    const msVoice = VOICES[requested] || DEFAULT_VOICE;

    // Optionally persist a Job row for the dashboard. NEVER fails
    // the request — if the DB is misconfigured (missing DATABASE_URL
    // on Vercel), the audio still goes back to the user.
    const job = await tryDbWrite(
      (db) =>
        db.job.create({
          data: {
            type: "tts",
            title: text.substring(0, 80),
            status: "processing",
            text: text.substring(0, MAX_TEXT),
            voice: msVoice,
          },
        }),
      "tts:create-job",
    );

    const audio = await synthesize(msVoice, text);

    // For the dashboard: store the durable URL pointing at /api/tts/audio/[id]
    // (regenerate-on-demand is handled there). Inline data URL is what the
    // page actually plays.
    const audioUrl = job ? `/api/tts/audio/${job.id}` : null;
    const dataUrl = `data:audio/mpeg;base64,${audio.toString("base64")}`;

    if (job) {
      await tryDbWrite(
        (db) =>
          db.job.update({
            where: { id: job.id },
            data: { status: "completed", progress: 100, audioUrl: audioUrl ?? undefined },
          }),
        "tts:complete-job",
      );
    }

    return NextResponse.json({
      id: job?.id ?? null,
      // Frontend prefers `audioUrl` if available (durable + replay-able
      // from dashboard), falls back to dataUrl. Always sending dataUrl
      // means the page works even with no DB at all.
      audioUrl: audioUrl ?? dataUrl,
      dataUrl,
      voice: msVoice,
      textLength: text.length,
      historyEnabled: Boolean(job),
    });
  } catch (error: unknown) {
    console.error("TTS error:", error);
    const message =
      error instanceof Error ? error.message : "TTS generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
