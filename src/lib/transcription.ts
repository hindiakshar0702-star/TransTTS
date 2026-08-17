import OpenAI, { toFile } from "openai";

/**
 * Whisper transcription core — synchronous and filesystem-free, so it runs on
 * serverless platforms (Vercel) without a writable disk or a background job.
 * The upload bytes go straight to the OpenAI SDK via `toFile()`.
 */

export const runtime = "nodejs";

/**
 * Content-based file-type validation. The Content-Type header and the filename
 * extension are attacker-controlled, so we sniff the actual bytes against known
 * audio/video container signatures.
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
      engine: "groq" as const,
    };
  }
  if (openaiKey && openaiKey !== "sk-your-api-key-here") {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: "whisper-1",
      engine: "openai" as const,
    };
  }
  return null;
}

/** Map internal errors to a safe, user-facing message. */
export function safeTranscribeError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("429") || lower.includes("quota") || lower.includes("billing")) {
    return "API quota exceeded. Get a FREE Groq key at console.groq.com";
  }
  if (lower.includes("401") || lower.includes("invalid api key")) {
    return "Invalid API key. Check GROQ_API_KEY / OPENAI_API_KEY.";
  }
  if (lower.includes("timeout") || lower.includes("etimedout")) {
    return "The transcription service timed out. Large files can take ~60s — please retry.";
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

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: TranscriptSegment[];
  engine: string;
}

/**
 * Transcribe raw media bytes with Whisper and return the result directly — no
 * disk, no database, no background job. `language` "auto" lets Whisper detect
 * the spoken language across its ~99 languages (English, Spanish, Chinese,
 * Hindi, Tamil, Telugu, Bengali, Marathi, and the rest). Throws on failure.
 */
export async function transcribeBuffer(
  buffer: Buffer,
  filename: string,
  language: string
): Promise<TranscriptionResult> {
  const config = getWhisperClient();
  if (!config) throw new Error("No transcription API key configured");

  // `toFile` packs the buffer into the multipart shape Whisper expects while
  // preserving the filename, whose extension helps codec detection.
  const audioFile = await toFile(buffer, filename || "audio.mp3");

  const transcription = (await config.client.audio.transcriptions.create({
    file: audioFile,
    model: config.model,
    language: language !== "auto" ? language : undefined,
    response_format: "verbose_json",
    // Only pass timestamp_granularities for openai to avoid a 400 on Groq.
    ...(config.engine === "openai" ? { timestamp_granularities: ["segment"] } : {}),
  } as unknown as Parameters<typeof config.client.audio.transcriptions.create>[0])) as unknown as WhisperVerbose;

  const segments = (transcription.segments || []).map((seg, idx) => ({
    id: idx,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));

  return {
    text: transcription.text,
    language: transcription.language || language,
    duration: transcription.duration || 0,
    segments,
    engine: config.engine,
  };
}
