import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { VOICES, DEFAULT_VOICE_KEY, MAX_TTS_CHARS, synthesizeToBuffer } from "@/lib/tts";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/tts — public, synchronous speech synthesis. No auth, no database,
 * no persistent disk: the MP3 is generated in the request and returned inline
 * as a data URL, which the client plays and can download directly.
 */
export async function POST(req: NextRequest) {
  const blocked = guard(req, "tts", { limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

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

    const audio = await synthesizeToBuffer(text, msVoice, rate);
    const audioUrl = `data:audio/mpeg;base64,${audio.toString("base64")}`;

    return NextResponse.json({ audioUrl, voice: msVoice, textLength: text.length });
  } catch (error: unknown) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "Voice generation failed. Please try again." }, { status: 500 });
  }
}
