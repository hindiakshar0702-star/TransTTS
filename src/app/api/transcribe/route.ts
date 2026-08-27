import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import {
  looksLikeMedia,
  getWhisperClient,
  safeTranscribeError,
  transcribeBuffer,
} from "@/lib/transcription";
import { MAX_UPLOAD_BYTES, WHISPER_MAX_BYTES, TRANSCRIPT_CONTEXT_CHARS } from "@/lib/utils";

export const runtime = "nodejs";
// Transcription can take a while; ask the platform for the longest it allows.
export const maxDuration = 60;

/**
 * Whatever the host lets through, never offer Whisper more than it accepts.
 * On Vercel the platform answers 413 well below either number, which is why
 * MAX_UPLOAD_BYTES defaults far under Whisper's cap — see lib/utils.
 */
const MAX_BYTES = Math.min(MAX_UPLOAD_BYTES, WHISPER_MAX_BYTES);
const MAX_MB = Math.round(MAX_BYTES / 1024 / 1024);

/**
 * POST /api/transcribe — public, synchronous transcription.
 *
 * No auth, no database, no disk: the upload bytes go straight to Whisper and the
 * transcript comes back in the same response. History is kept client-side. This
 * shape runs on serverless free tiers, which cannot do background work or write
 * to a persistent disk.
 */
export async function POST(req: NextRequest) {
  // Whisper is a metered API even on the free tier — cap abuse per IP.
  const blocked = guard(req, "transcribe", { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  if (!getWhisperClient()) {
    return NextResponse.json(
      { error: "No API key configured. Add GROQ_API_KEY (free at console.groq.com) or OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = (formData.get("language") as string) || "auto";

    // Optional tail of the previous part, for files split across requests.
    // Truncated rather than rejected: it is a hint, and Whisper ignores a
    // prompt past roughly 224 tokens anyway.
    const rawContext = formData.get("context");
    const context =
      typeof rawContext === "string" ? rawContext.slice(-TRANSCRIPT_CONTEXT_CHARS).trim() : "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large. Maximum ${MAX_MB}MB.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Validate real file type by magic number — never trust extension/Content-Type.
    if (!looksLikeMedia(buffer)) {
      return NextResponse.json(
        { error: "Unsupported file. Upload a real audio or video file (MP3, WAV, MP4, MKV, OGG, FLAC, WebM)." },
        { status: 415 }
      );
    }

    const result = await transcribeBuffer(buffer, file.name, language, context || undefined);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Transcription error:", error);
    const raw = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: safeTranscribeError(raw) }, { status: 500 });
  }
}
