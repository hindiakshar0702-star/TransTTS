import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { tryDbWrite } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/transcribe
 *
 * Sends user-uploaded audio to Whisper (Groq's free Whisper-Large-V3-Turbo
 * by default, OpenAI Whisper-1 as a paid fallback) and returns the
 * transcript with timestamped segments.
 *
 * Production-grade fixes vs the old version:
 *
 *   - NO FILESYSTEM. We pass the upload bytes straight to the OpenAI
 *     SDK via `toFile(buffer, filename)`. The old code used
 *     `fs.writeFileSync(process.cwd() + "/uploads/...")` which fails
 *     on Vercel because the project root is read-only.
 *
 *   - GRACEFUL DB. The Job history row is best-effort; if Prisma can't
 *     reach DATABASE_URL, the user still gets their transcript instead
 *     of a 500.
 *
 *   - CLEAR ERRORS. We distinguish 'no API key configured', 'quota
 *     exhausted', and 'gateway timeout' so the user sees something
 *     actionable instead of a generic 'Transcription failed'.
 */

const MAX_BYTES = 25 * 1024 * 1024; // Whisper hard cap

interface WhisperConfig {
  client: OpenAI;
  model: string;
  engine: "groq" | "openai";
}

function getClient(): WhisperConfig | null {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Reject placeholder values left in templates.
  const isReal = (k: string | undefined) =>
    !!k && k !== "your-groq-api-key-here" && k !== "sk-your-api-key-here";

  if (isReal(groqKey)) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "whisper-large-v3-turbo",
      engine: "groq",
    };
  }
  if (isReal(openaiKey)) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: "whisper-1",
      engine: "openai",
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  let jobId: string | null = null;

  try {
    const config = getClient();
    if (!config) {
      return NextResponse.json(
        {
          error:
            "No transcription API key configured on the server. " +
            "Set GROQ_API_KEY (free at console.groq.com) or OPENAI_API_KEY in your Vercel env vars.",
        },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const language = (formData.get("language") as string) || "auto";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum 25 MB." },
        { status: 400 },
      );
    }

    // Best-effort history row — never blocks on DB failure.
    const job = await tryDbWrite(
      (db) =>
        db.job.create({
          data: {
            type: "transcribe",
            title: file.name || "Audio",
            status: "processing",
            progress: 10,
            fileName: file.name || "upload",
            fileSize: file.size,
            language,
          },
        }),
      "transcribe:create-job",
    );
    jobId = job?.id ?? null;

    // Read upload into memory and hand it straight to the SDK — no disk
    // writes. `toFile` packs the buffer into the multipart format Whisper
    // expects and lets us preserve the original filename for the model
    // hint (extensions matter for codec detection).
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "audio.mp3";
    const audioFile = await toFile(buffer, filename);

    if (jobId) {
      await tryDbWrite(
        (db) =>
          db.job.update({ where: { id: jobId! }, data: { progress: 30 } }),
        "transcribe:progress-30",
      );
    }

    const transcription = await config.client.audio.transcriptions.create({
      file: audioFile,
      model: config.model,
      language: language !== "auto" ? language : undefined,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    type WhisperSegment = { start: number; end: number; text: string };
    const segments = (
      (transcription as { segments?: WhisperSegment[] }).segments ?? []
    ).map((seg, idx) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    if (jobId) {
      await tryDbWrite(
        (db) =>
          db.job.update({
            where: { id: jobId! },
            data: {
              status: "completed",
              progress: 100,
              language: transcription.language || language,
              duration: transcription.duration || 0,
              transcript: transcription.text,
              segments: JSON.stringify(segments),
            },
          }),
        "transcribe:complete-job",
      );
    }

    return NextResponse.json({
      id: jobId,
      text: transcription.text,
      language: transcription.language || language,
      duration: transcription.duration || 0,
      segments,
      engine: config.engine,
      historyEnabled: Boolean(jobId),
    });
  } catch (error: unknown) {
    console.error("Transcription error:", error);
    let message =
      error instanceof Error ? error.message : "Transcription failed";

    // Surface common Whisper failures as actionable messages.
    const lower = message.toLowerCase();
    if (lower.includes("429") || lower.includes("quota") || lower.includes("billing")) {
      message =
        "API quota exceeded. Get a FREE Groq key at https://console.groq.com and set GROQ_API_KEY.";
    } else if (lower.includes("401") || lower.includes("invalid api key")) {
      message = "Invalid API key. Check GROQ_API_KEY / OPENAI_API_KEY in your env vars.";
    } else if (lower.includes("timeout") || lower.includes("etimedout")) {
      message = "Transcription provider timed out. Please retry — large files can take ~60s.";
    }

    if (jobId) {
      await tryDbWrite(
        (db) =>
          db.job.update({
            where: { id: jobId! },
            data: { status: "error", errorMsg: message },
          }),
        "transcribe:fail-job",
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
