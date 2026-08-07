import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { getGeneratedDir } from "@/lib/server-utils";

/**
 * Speech synthesis core, shared by the /api/tts route.
 *
 * Synthesis takes seconds and used to run inside the POST handler, holding the
 * request open the whole time. It now runs in the background against a job row
 * the client polls, matching the transcription flow.
 *
 * Node-only (fs, network, database).
 */

export const runtime = "nodejs";

/** Allow-listed voices — the client may only pick a key from this map. */
export const VOICES = new Map<string, string>([
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

export const DEFAULT_VOICE_KEY = "hi-female";
export const MAX_TTS_CHARS = 5000;

/**
 * Identifies one synthesis request. Same text, voice and rate always produce
 * the same audio, so a match means the file can be reused.
 */
export function ttsCacheKey(text: string, voice: string, rate: number): string {
  return createHash("sha256").update(`${voice}|${rate}|${text}`).digest("hex");
}

/**
 * Find audio this user already generated for an identical request, and confirm
 * the file is still on disk — the cleanup sweep may have removed it.
 *
 * Deliberately scoped to one user: sharing files between accounts would mean
 * one person clearing their history deletes audio another person's job still
 * points at.
 */
export async function findCachedAudio(
  userId: string,
  cacheKey: string
): Promise<string | null> {
  const previous = await prisma.job.findFirst({
    where: { userId, cacheKey, type: "tts", status: "completed", audioUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { audioUrl: true },
  });
  if (!previous?.audioUrl) return null;

  const fileId = previous.audioUrl.split("/").pop();
  if (!fileId || !/^[a-zA-Z0-9-]+$/.test(fileId)) return null;

  const generatedDir = getGeneratedDir();
  const filePath = path.normalize(path.join(generatedDir, `${fileId}.mp3`));
  if (!filePath.startsWith(generatedDir)) return null;

  const stillThere = await fs.access(filePath).then(() => true).catch(() => false);
  return stillThere ? previous.audioUrl : null;
}

/**
 * Synthesise `text` and record the result on `jobId`. Throwing is allowed —
 * the caller marks the job as errored.
 */
export async function synthesizeForJob(
  jobId: string,
  text: string,
  msVoice: string,
  rate: number,
  cacheKey: string
): Promise<string> {
  const generatedDir = getGeneratedDir();
  const fileId = generateId();
  const tempDir = path.normalize(path.join(generatedDir, fileId));

  // Path traversal defense-in-depth.
  if (!tempDir.startsWith(generatedDir)) {
    throw new Error("Invalid generated directory path");
  }

  await prisma.job.update({ where: { id: jobId }, data: { progress: 40 } });
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(msVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    await tts.toFile(tempDir, text, { rate });

    const generatedFile = path.normalize(path.join(tempDir, "audio.mp3"));
    const finalPath = path.normalize(path.join(generatedDir, `${fileId}.mp3`));
    if (!generatedFile.startsWith(tempDir) || !finalPath.startsWith(generatedDir)) {
      throw new Error("Invalid file paths");
    }

    const produced = await fs.access(generatedFile).then(() => true).catch(() => false);
    if (!produced) throw new Error("Audio file was not generated");

    await fs.rename(generatedFile, finalPath);

    const audioUrl = `/api/tts/audio/${fileId}`;
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "completed", progress: 100, audioUrl, cacheKey },
    });
    return audioUrl;
  } finally {
    // Remove the temp directory whether or not synthesis succeeded, so an
    // interrupted run does not leave one behind for the sweep to find.
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
