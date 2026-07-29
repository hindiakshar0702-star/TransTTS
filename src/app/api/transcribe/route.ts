import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { getUploadsDir } from "@/lib/server-utils";
import { guard } from "@/lib/api-guard";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

/**
 * Content-based file-type validation. The Content-Type header and the filename
 * extension are attacker-controlled, so we sniff the actual bytes against known
 * audio/video container signatures. Rejects anything that isn't a real media
 * container before it is written to disk or forwarded to the Whisper API.
 */
function looksLikeMedia(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ascii = (start: number, len: number) => buf.toString("latin1", start, start + len);
  const b = (i: number) => buf[i];

  // MP3 with ID3 tag, or raw MP3 frame sync (0xFFEx / 0xFFFx)
  if (ascii(0, 3) === "ID3") return true;
  if (b(0) === 0xff && (b(1) & 0xe0) === 0xe0) return true; // MP3 / AAC-ADTS

  // RIFF containers: WAV / AVI
  if (ascii(0, 4) === "RIFF" && (ascii(8, 4) === "WAVE" || ascii(8, 4) === "AVI ")) return true;

  if (ascii(0, 4) === "OggS") return true; // OGG / Opus
  if (ascii(0, 4) === "fLaC") return true; // FLAC

  // ISO-BMFF: MP4 / M4A / MOV — "ftyp" box at offset 4
  if (ascii(4, 4) === "ftyp") return true;

  // Matroska / WebM (EBML header)
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return true;

  // MPEG program stream / elementary stream start code
  if (b(0) === 0x00 && b(1) === 0x00 && b(2) === 0x01) return true;
  if (b(0) === 0x47) return true; // MPEG-TS sync byte

  return false;
}

function getClient() {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey && groqKey !== "your-groq-api-key-here") {
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }),
      model: "whisper-large-v3-turbo",
      engine: "groq",
    };
  }
  if (openaiKey && openaiKey !== "sk-your-api-key-here") {
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

  // Abuse control: transcription hits a paid Whisper API — cap it hard.
  const blocked = guard(req, "transcribe", { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  try {
    const config = getClient();
    if (!config) {
      return NextResponse.json(
        { error: "No API key configured. Add GROQ_API_KEY (free) or OPENAI_API_KEY to .env.local" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = (formData.get("language") as string) || "auto";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 25MB." }, { status: 400 });
    }

    // Validate real file type by magic number — never trust extension/Content-Type.
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!looksLikeMedia(fileBuffer)) {
      return NextResponse.json(
        { error: "Unsupported file. Upload a real audio or video file (MP3, WAV, MP4, MKV, OGG, FLAC, WebM)." },
        { status: 415 }
      );
    }

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        type: "transcribe",
        title: file.name,
        status: "processing",
        progress: 10,
        fileName: file.name,
        fileSize: file.size,
        language: language,
      },
    });
    jobId = job.id;

    // Save file
    const uploadsDir = getUploadsDir();
    const fileId = generateId();
    let ext = path.extname(file.name) || ".mp3";
    // Sanitize extension to prevent any injection/traversal
    ext = ext.replace(/[^a-zA-Z0-9.]/g, "");
    if (!ext.startsWith(".")) ext = "." + ext;

    const filePath = path.normalize(path.join(uploadsDir, `${fileId}${ext}`));
    
    // Verify path traversal defense-in-depth
    if (!filePath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    try {
      fs.writeFileSync(filePath, fileBuffer);

      // Update progress
      await prisma.job.update({ where: { id: jobId }, data: { progress: 30 } });

      // Whisper verbose_json response shape (not fully typed by the SDK for all engines)
      interface WhisperSegment { start: number; end: number; text: string }
      interface WhisperVerbose {
        text: string;
        language?: string;
        duration?: number;
        segments?: WhisperSegment[];
      }

      // Transcribe with Whisper
      const transcription = (await config.client.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: config.model,
        language: language !== "auto" ? language : undefined,
        response_format: "verbose_json",
        // Only pass timestamp_granularities for openai to avoid 400 Bad Request on Groq
        ...(config.engine === "openai" ? { timestamp_granularities: ["segment"] } : {}),
      } as unknown as Parameters<typeof config.client.audio.transcriptions.create>[0])) as unknown as WhisperVerbose;

      const segments = (transcription.segments || []).map((seg: WhisperSegment, idx: number) => ({
        id: idx,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      // Save result to DB
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "completed",
          progress: 100,
          language: transcription.language || language,
          duration: transcription.duration || 0,
          transcript: transcription.text,
          segments: JSON.stringify(segments),
        },
      });

      return NextResponse.json({
        id: jobId,
        text: transcription.text,
        language: transcription.language || language,
        duration: transcription.duration || 0,
        segments,
        engine: config.engine,
      });
    } finally {
      // Clean up file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        /* ignore */
      }
    }
  } catch (error: unknown) {
    console.error("Transcription error:", error);
    let message = error instanceof Error ? error.message : "Transcription failed";

    if (message.includes("429") || message.includes("quota") || message.includes("billing")) {
      message = "API quota exceeded. Get a FREE Groq key at console.groq.com";
    }

    // Update job as failed
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "error", errorMsg: message },
      }).catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
