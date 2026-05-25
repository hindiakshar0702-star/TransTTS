import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  synthesizeMp3,
  resolveVoice,
  TTS_MAX_TEXT,
} from "@/lib/tts";

export const runtime = "nodejs";

/**
 * POST /api/tts
 *
 * Body: { text: string, voice?: string }
 *
 * Returns:
 *   {
 *     id: string,            // Job.id — stable, doubles as the persistent URL slug
 *     audioUrl: string,      // /api/tts/audio/<jobId>  (regenerated on demand)
 *     dataUrl: string,       // data:audio/mpeg;base64,...   (instant <audio src>)
 *     voice: string,         // canonical MS voice id used
 *     textLength: number,
 *   }
 *
 * Why both URLs?
 *   - `dataUrl` is consumed by the page that just ran the synthesis so
 *     the user can hit ▶ with zero round-trips. No filesystem state.
 *   - `audioUrl` is what we persist in history. The audio is rebuilt from
 *     the Job's `text` + `voice` columns on demand by `/api/tts/audio/[id]`,
 *     so the link never 404s — even after a Vercel deploy or cold start.
 *
 * This eliminates BUG-002 (TTS audio FS persistence) without requiring
 * external object storage.
 */
export async function POST(req: NextRequest) {
  let jobId: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { text, voice } = body as { text?: unknown; voice?: unknown };

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    if (text.length > TTS_MAX_TEXT) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${TTS_MAX_TEXT} characters.` },
        { status: 400 },
      );
    }

    const msVoice = resolveVoice(typeof voice === "string" ? voice : null);

    // Persist the Job FIRST. If TTS fails, the row is already there with
    // status='processing' and the catch block will downgrade it to error.
    const job = await prisma.job.create({
      data: {
        type: "tts",
        title: text.substring(0, 80),
        status: "processing",
        text: text.substring(0, TTS_MAX_TEXT),
        voice: msVoice,
      },
    });
    jobId = job.id;

    const audio = await synthesizeMp3(msVoice, text);

    const audioUrl = `/api/tts/audio/${jobId}`;
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "completed", progress: 100, audioUrl },
    });

    // base64 of a 24kHz/96kbps MP3 for 5,000 chars ≈ 100-300 KB —
    // well under any practical JSON / data-URL limit.
    const dataUrl = `data:audio/mpeg;base64,${audio.toString("base64")}`;

    return NextResponse.json({
      id: jobId,
      audioUrl,
      dataUrl,
      voice: msVoice,
      textLength: text.length,
    });
  } catch (error: unknown) {
    console.error("TTS error:", error);
    const message =
      error instanceof Error ? error.message : "TTS generation failed";

    if (jobId) {
      await prisma.job
        .update({
          where: { id: jobId },
          data: { status: "error", errorMsg: message },
        })
        .catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
