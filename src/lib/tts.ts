import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Speech synthesis core (Microsoft Edge neural voices — free, no API key).
 *
 * Serverless-friendly: msedge-tts writes a file, so we write into the platform
 * temp dir (/tmp, writable and ephemeral on Vercel), read the bytes back,
 * return them, and delete the temp dir. Nothing is persisted — the audio comes
 * back inline in the response.
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
 * Synthesise `text` and return the MP3 bytes. `rate` is the speaking speed
 * (0.5–2.0). Throws on failure.
 */
export async function synthesizeToBuffer(
  text: string,
  msVoice: string,
  rate: number
): Promise<Buffer> {
  const tempDir = path.join(os.tmpdir(), `tts-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(msVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    await tts.toFile(tempDir, text, { rate });

    const filePath = path.join(tempDir, "audio.mp3");
    const produced = await fs.access(filePath).then(() => true).catch(() => false);
    if (!produced) throw new Error("Audio file was not generated");

    return await fs.readFile(filePath);
  } finally {
    // Best-effort cleanup — the temp dir is ephemeral anyway on serverless.
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
