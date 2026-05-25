import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import fs from "fs";

/**
 * Voice id (frontend-friendly) → Microsoft Edge neural voice name.
 * Single source of truth for both the TTS POST endpoint and the
 * regenerate-on-demand audio endpoint.
 */
export const VOICES: Record<string, string> = {
  "hi-female": "hi-IN-SwaraNeural",
  "hi-male": "hi-IN-MadhurNeural",
  "en-female": "en-US-JennyNeural",
  "en-male": "en-US-GuyNeural",
  "en-uk-female": "en-GB-SoniaNeural",
  "en-uk-male": "en-GB-RyanNeural",
  "es-female": "es-ES-ElviraNeural",
  "fr-female": "fr-FR-DeniseNeural",
  "de-female": "de-DE-KatjaNeural",
  "ja-female": "ja-JP-NanamiNeural",
  "ko-female": "ko-KR-SunHiNeural",
  "ar-male": "ar-SA-HamedNeural",
  "pt-female": "pt-BR-FranciscaNeural",
  "bn-female": "bn-IN-TanishaaNeural",
  "ta-female": "ta-IN-PallaviNeural",
  "te-female": "te-IN-ShrutiNeural",
  "mr-female": "mr-IN-AarohiNeural",
  "gu-female": "gu-IN-DhwaniNeural",
  "ur-male": "ur-PK-AsadNeural",
};

export const DEFAULT_VOICE = VOICES["hi-female"];
export const TTS_MAX_TEXT = 5000;

/**
 * Generate an MP3 in-memory and return the Buffer.
 *
 * Why this design (vs writing to a long-lived file):
 *   - Vercel function instances have separate, ephemeral file systems.
 *     A file written by one instance is invisible to another, and `/tmp`
 *     is wiped at cold start.
 *   - We use `os.tmpdir()` (always writable, even on read-only roots)
 *     ONLY as a transient workspace, then read the buffer back into
 *     memory and immediately delete the directory.
 *   - The caller decides what to do with the bytes — stream them as the
 *     HTTP response body, base64-encode them into a JSON payload, or
 *     forward to object storage.
 *
 * msedge-tts v2 ships `toFile(dir, text)` as the most stable API across
 * runtimes; `toStream` exists but its return shape varies between
 * minor versions. The temp-file detour costs <10ms in practice.
 *
 * @param msEdgeVoice Full Microsoft voice id (e.g. "hi-IN-SwaraNeural")
 * @param text        UTF-8 text to synthesise (caller validates length)
 */
export async function synthesizeMp3(
  msEdgeVoice: string,
  text: string,
): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `tts-${randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      msEdgeVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    );
    await tts.toFile(tmpDir, text);

    const filePath = path.join(tmpDir, "audio.mp3");
    if (!fs.existsSync(filePath)) {
      throw new Error("TTS engine did not produce an audio file");
    }
    return fs.readFileSync(filePath);
  } finally {
    // Best-effort cleanup; never let cleanup failures mask real errors.
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Resolve a frontend voice id (e.g. "hi-female") OR a full MS voice
 * name (e.g. "hi-IN-SwaraNeural") to the canonical MS voice name.
 * Falls back to DEFAULT_VOICE for unknown values.
 */
export function resolveVoice(voice: string | undefined | null): string {
  if (!voice) return DEFAULT_VOICE;
  if (VOICES[voice]) return VOICES[voice];
  // Already a full MS voice name (e.g. "hi-IN-SwaraNeural") — accept as-is
  // if it looks plausible, otherwise fall back to default.
  if (/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(voice)) return voice;
  return DEFAULT_VOICE;
}
