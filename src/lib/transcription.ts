import OpenAI from "openai";
import fs from "fs";
import prisma from "@/lib/prisma";

/**
 * Shared Whisper transcription core, used by both the direct-upload route
 * (/api/transcribe) and the social-video route (/api/social-transcribe).
 * Node-only (fs, network, env) — never import from client components.
 */

export const runtime = "nodejs";

/**
 * Content-based file-type validation. The Content-Type header and the filename
 * extension are attacker-controlled, so we sniff the actual bytes against known
 * audio/video container signatures. Rejects anything that isn't a real media
 * container before it is written to disk or forwarded to the Whisper API.
 */
export function looksLikeMedia(buf: Buffer): boolean {
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

/** Pick the configured Whisper backend: Groq (free tier) first, then OpenAI. */
export function getWhisperClient() {
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

/** Map internal errors to a safe, user-facing message. */
export function safeTranscribeError(raw: string): string {
  if (raw.includes("429") || raw.includes("quota") || raw.includes("billing")) {
    return "API quota exceeded. Get a FREE Groq key at console.groq.com";
  }
  return "Transcription failed. Please try again.";
}

interface WhisperSegment { start: number; end: number; text: string }
interface WhisperVerbose {
  text: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

/**
 * Run Whisper on a media file already saved to disk and persist the result on
 * the job row. Language "auto" lets Whisper detect the spoken language (works
 * across English, Spanish, Chinese, Hindi, Tamil, Telugu, Bengali, Marathi and
 * the rest of Whisper's ~99 languages). Deletes the file when done.
 * Throwing is allowed — callers mark the job as errored.
 */
export async function transcribeFileForJob(
  jobId: string,
  filePath: string,
  language: string
): Promise<TranscriptionResult> {
  const config = getWhisperClient();
  if (!config) throw new Error("No transcription API key configured");

  try {
    await prisma.job.update({ where: { id: jobId }, data: { progress: 40 } });

    const transcription = (await config.client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: config.model,
      language: language !== "auto" ? language : undefined,
      response_format: "verbose_json",
      // Only pass timestamp_granularities for openai to avoid 400 Bad Request on Groq
      ...(config.engine === "openai" ? { timestamp_granularities: ["segment"] } : {}),
    } as unknown as Parameters<typeof config.client.audio.transcriptions.create>[0])) as unknown as WhisperVerbose;

    const segments = (transcription.segments || []).map((seg, idx) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    const detectedLang = transcription.language || language;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "completed",
        progress: 100,
        language: detectedLang,
        duration: transcription.duration || 0,
        transcript: transcription.text,
        segments: JSON.stringify(segments),
        engine: config.engine,
      },
    });

    return {
      text: transcription.text,
      language: detectedLang,
      duration: transcription.duration || 0,
    };
  } finally {
    await fs.promises.unlink(filePath).catch(() => {});
  }
}
