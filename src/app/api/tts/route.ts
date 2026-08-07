import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { getSessionUser } from "@/lib/auth";
import { maybeSweepMedia } from "@/lib/media-cleanup";
import {
  VOICES,
  DEFAULT_VOICE_KEY,
  MAX_TTS_CHARS,
  ttsCacheKey,
  findCachedAudio,
  synthesizeForJob,
} from "@/lib/tts";

export const runtime = "nodejs";

/**
 * Non-blocking speech synthesis.
 *
 * Synthesis takes seconds, so the request no longer waits for it: this handler
 * validates, creates the job row, starts the work in the background and returns
 * 202 with a jobId. The client polls GET /api/jobs/:id, exactly as the
 * transcription flow does.
 *
 * A repeat of an identical request (same text, voice and rate) short-circuits
 * to the audio the user already has, and returns 200 instead of 202 so the
 * client can skip polling entirely.
 */
export async function POST(req: NextRequest) {
  const blocked = guard(req, "tts", { limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Opportunistic disk housekeeping — throttled internally, never awaited.
  maybeSweepMedia();

  let jobId: string | null = null;
  try {
    const { text, voice, speed } = await req.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    if (text.length > MAX_TTS_CHARS) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${MAX_TTS_CHARS} characters.` },
        { status: 400 }
      );
    }

    // Clamp speed to the slider's allowed range; ignore non-numeric input.
    const rate =
      typeof speed === "number" && isFinite(speed)
        ? Math.min(2.0, Math.max(0.5, speed))
        : 1.0;

    const msVoice =
      typeof voice === "string" && VOICES.has(voice)
        ? (VOICES.get(voice) as string)
        : (VOICES.get(DEFAULT_VOICE_KEY) as string);

    const cacheKey = ttsCacheKey(text, msVoice, rate);

    // Already generated this exact clip and the file is still on disk — hand
    // it back without paying for synthesis again.
    const cached = await findCachedAudio(sessionUser.id, cacheKey);
    if (cached) {
      const job = await prisma.job.create({
        data: {
          userId: sessionUser.id,
          type: "tts",
          title: text.substring(0, 80),
          status: "completed",
          progress: 100,
          text: text.substring(0, 2000),
          voice: msVoice,
          audioUrl: cached,
          cacheKey,
        },
      });
      return NextResponse.json({
        jobId: job.id,
        status: "completed",
        audioUrl: cached,
        voice: msVoice,
        cached: true,
      });
    }

    const job = await prisma.job.create({
      data: {
        userId: sessionUser.id,
        type: "tts",
        title: text.substring(0, 80),
        status: "processing",
        progress: 10,
        text: text.substring(0, 2000),
        voice: msVoice,
        cacheKey,
      },
    });
    jobId = job.id;

    // Fire-and-forget: the job row carries the outcome.
    void synthesizeForJob(job.id, text, msVoice, rate, cacheKey).catch(async (err) => {
      const raw = err instanceof Error ? err.message : "";
      console.error("TTS error:", err);
      await prisma.job
        .update({
          where: { id: job.id },
          data: { status: "error", errorMsg: raw || "TTS generation failed" },
        })
        .catch(() => {});
    });

    return NextResponse.json(
      { jobId: job.id, status: "processing", voice: msVoice, cached: false },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error("TTS intake error:", error);
    const raw = error instanceof Error ? error.message : "";

    if (jobId) {
      await prisma.job
        .update({ where: { id: jobId }, data: { status: "error", errorMsg: raw || "TTS failed" } })
        .catch(() => {});
    }

    // Generic message to the client; full detail stays in the log / job row.
    return NextResponse.json({ error: "Voice generation failed. Please try again." }, { status: 500 });
  }
}
