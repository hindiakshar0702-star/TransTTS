/**
 * Splitting audio in the browser so it fits the host's upload limit.
 *
 * The deployment cannot receive more than a few megabytes per request — see
 * MAX_UPLOAD_BYTES in lib/utils — but the files people actually have are
 * longer than that. Rather than refuse them, the client cuts them into pieces
 * that each fit, transcribes the pieces, and stitches the results.
 *
 * Three strategies, tried in order of how good the result is:
 *
 *  - Where the browser has an Opus encoder, the audio is re-encoded at speech
 *    bitrate. This is the only strategy that makes the file *smaller* rather
 *    than merely divisible, so it usually results in a single upload.
 *  - MP3 is a bare sequence of self-contained frames. Cutting on a frame
 *    boundary yields files that are still valid MP3, with no decode, no
 *    re-encode and no quality loss. This is the fast path.
 *  - Everything else is decoded, mixed to mono, resampled to 16 kHz (what
 *    Whisper works at anyway) and written out as WAV. Lossy in the sense that
 *    it discards bandwidth Whisper does not use, and much bigger per second
 *    than a compressed format, but it works for any input the browser can
 *    decode.
 *
 * Byte-slicing is deliberately not offered. Cutting a compressed stream at an
 * arbitrary offset produces pieces that are not decodable files, and the API
 * rejects them at the magic-number check.
 */

import { canEncodeOpus, encodeOggOpus, OPUS_BITRATE } from "@/lib/oggOpus";

/** Opus is defined at 48 kHz, so the encoder is fed at that rate. */
export const OPUS_SAMPLE_RATE = 48000;

/** Whisper is trained at 16 kHz; sending more is bandwidth it discards. */
export const TARGET_SAMPLE_RATE = 16000;

export interface AudioPart {
  blob: Blob;
  /** Playing time of this part, used to offset the transcript timestamps. */
  seconds: number;
}

export interface PreparedUpload {
  parts: AudioPart[];
  /** How the file was divided, for the progress copy. */
  method: "single" | "opus" | "mp3-split" | "decode-split";
}

/* ------------------------------------------------------------------ MP3 -- */

/** Layer III bitrates in kbps, indexed by the header's bitrate field. */
const BITRATES_MPEG1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/** Sample rates by MPEG version field: 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5. */
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

interface Mp3Frame {
  offset: number;
  length: number;
  seconds: number;
}

/** True if `bytes` starts with an ID3v2 tag or an MPEG audio sync word. */
export function looksLikeMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // "ID3"
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

/** Length of the leading ID3v2 tag, which is metadata rather than audio. */
function id3v2Length(bytes: Uint8Array): number {
  if (bytes.length < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  // A syndsafe integer: seven bits per byte, high bit always clear.
  const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  return 10 + size;
}

/**
 * Walk the frame headers of an MP3.
 *
 * Anything that does not parse as a Layer III header is skipped a byte at a
 * time rather than treated as fatal: real files carry ID3v1 trailers, album
 * art and the occasional junk byte between frames, and none of that should
 * stop the scan.
 */
export function parseMp3Frames(bytes: Uint8Array): Mp3Frame[] {
  const frames: Mp3Frame[] = [];
  let pos = id3v2Length(bytes);

  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff || (bytes[pos + 1] & 0xe0) !== 0xe0) {
      pos++;
      continue;
    }

    const version = (bytes[pos + 1] >> 3) & 3;
    const layer = (bytes[pos + 1] >> 1) & 3;
    const bitrateIndex = (bytes[pos + 2] >> 4) & 0xf;
    const rateIndex = (bytes[pos + 2] >> 2) & 3;
    const padding = (bytes[pos + 2] >> 1) & 1;

    // version 1 is reserved, layer 1 means Layer III, index 0/15 are
    // "free"/"bad", rate index 3 is reserved.
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
      pos++;
      continue;
    }

    const isMpeg1 = version === 3;
    const bitrate = (isMpeg1 ? BITRATES_MPEG1 : BITRATES_MPEG2)[bitrateIndex] * 1000;
    const sampleRate = SAMPLE_RATES[version][rateIndex];
    const length = Math.floor((isMpeg1 ? 144 : 72) * bitrate / sampleRate) + padding;
    if (length < 4 || pos + length > bytes.length) {
      pos++;
      continue;
    }

    frames.push({ offset: pos, length, seconds: (isMpeg1 ? 1152 : 576) / sampleRate });
    pos += length;
  }

  return frames;
}

/**
 * Cut an MP3 into pieces no larger than `maxBytes`, always on a frame
 * boundary. Returns an empty array if the file does not parse as MP3, so the
 * caller can fall back rather than upload something broken.
 */
export function splitMp3(bytes: Uint8Array, maxBytes: number): AudioPart[] {
  const frames = parseMp3Frames(bytes);
  if (frames.length === 0) return [];

  const parts: AudioPart[] = [];
  let start = 0;
  let size = 0;
  let seconds = 0;

  const flush = (endExclusive: number) => {
    if (endExclusive <= start) return;
    const from = frames[start].offset;
    const last = frames[endExclusive - 1];
    parts.push({
      blob: new Blob([bytes.slice(from, last.offset + last.length)], { type: "audio/mpeg" }),
      seconds,
    });
  };

  for (let i = 0; i < frames.length; i++) {
    // A single frame over the limit cannot be split any finer; let it through
    // as its own part and let the server say no.
    if (size > 0 && size + frames[i].length > maxBytes) {
      flush(i);
      start = i;
      size = 0;
      seconds = 0;
    }
    size += frames[i].length;
    seconds += frames[i].seconds;
  }
  flush(frames.length);

  return parts;
}

/* ------------------------------------------------------------------ WAV -- */

/** 16-bit PCM WAV around `samples`. Mono, at `sampleRate`. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    // Asymmetric on purpose: -1 maps to -32768, +1 to 32767.
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Bytes one second of mono 16-bit PCM occupies at the target rate. */
export const WAV_BYTES_PER_SECOND = TARGET_SAMPLE_RATE * 2;

/**
 * Decode anything the browser understands, flatten it to 16 kHz mono, and cut
 * it into WAV pieces under `maxBytes`.
 */
async function decodeToMono(file: File, sampleRate: number): Promise<Float32Array> {
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const decodeContext = new AudioContextClass();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(await file.arrayBuffer());
  } finally {
    decodeContext.close();
  }

  // OfflineAudioContext does the mixdown and the resampling for us.
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}

export async function splitByDecoding(file: File, maxBytes: number): Promise<AudioPart[]> {
  const pcm = await decodeToMono(file, TARGET_SAMPLE_RATE);

  // Header included, so a part never lands a few bytes over the limit.
  const samplesPerPart = Math.floor((maxBytes - 44) / 2);
  const parts: AudioPart[] = [];
  for (let offset = 0; offset < pcm.length; offset += samplesPerPart) {
    const slice = pcm.subarray(offset, Math.min(offset + samplesPerPart, pcm.length));
    parts.push({
      blob: encodeWav(slice, TARGET_SAMPLE_RATE),
      seconds: slice.length / TARGET_SAMPLE_RATE,
    });
  }

  return parts;
}

/* ----------------------------------------------------------------- opus -- */

/**
 * Re-encode to Ogg Opus, in as few pieces as the limit allows.
 *
 * This is the strategy that makes a long file small rather than merely
 * divisible: at 24 kbps a part holds around twenty minutes, so most recordings
 * become a single upload and a single Whisper call.
 *
 * The number of parts is worked out from the bitrate before encoding, so each
 * piece is encoded once. A tenth is held back for the Ogg page headers, which
 * the bitrate does not account for.
 */
export async function splitByOpus(file: File, maxBytes: number): Promise<AudioPart[]> {
  const pcm = await decodeToMono(file, OPUS_SAMPLE_RATE);
  const bytesPerSecond = OPUS_BITRATE / 8;
  const secondsPerPart = Math.max(1, Math.floor((maxBytes * 0.9) / bytesPerSecond));
  const samplesPerPart = secondsPerPart * OPUS_SAMPLE_RATE;

  const parts: AudioPart[] = [];
  for (let offset = 0; offset < pcm.length; offset += samplesPerPart) {
    const slice = pcm.subarray(offset, Math.min(offset + samplesPerPart, pcm.length));
    parts.push({
      blob: await encodeOggOpus(slice),
      seconds: slice.length / OPUS_SAMPLE_RATE,
    });
  }

  // Opus is variable rate, so a dense passage can still overshoot the estimate.
  // Rather than send something the host will bounce, let the caller fall back.
  if (parts.some((part) => part.blob.size > maxBytes)) return [];

  return parts;
}

/* -------------------------------------------------------------- dispatch -- */

/**
 * Get `file` into pieces the server will accept.
 *
 * A file already under the limit is passed through untouched — no decode, no
 * re-encode, nothing to go wrong.
 */
export async function prepareUpload(file: File, maxBytes: number): Promise<PreparedUpload> {
  if (file.size <= maxBytes) {
    return { parts: [{ blob: file, seconds: 0 }], method: "single" };
  }

  // Preferred when the browser has an Opus encoder: it usually turns the whole
  // file into one upload instead of several, and one Whisper call instead of
  // several. Both fallbacks below only divide, so they stay large.
  if (await canEncodeOpus()) {
    try {
      const parts = await splitByOpus(file, maxBytes);
      if (parts.length > 0) return { parts, method: "opus" };
    } catch (err) {
      console.warn("Opus re-encoding unavailable, falling back to splitting:", err);
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (looksLikeMp3(bytes)) {
    const parts = splitMp3(bytes, maxBytes);
    // An empty result means the sniff was right but the frames were not, so
    // fall through to decoding rather than uploading nothing.
    if (parts.length > 0) return { parts, method: "mp3-split" };
  }

  return { parts: await splitByDecoding(file, maxBytes), method: "decode-split" };
}

/**
 * Name a part after the file it came from, with an extension matching what the
 * part actually contains.
 *
 * The extension is not cosmetic: the transcription API passes the filename
 * through to Whisper, which uses it to pick a demuxer. An MP3 slice called
 * ".webm" — the original recording's extension — gets handed to the wrong one.
 */
export function partFileName(original: string, index: number, total: number, mimeType: string): string {
  const stem = original.replace(/\.[^.\\/]+$/, "") || "audio";
  const extension = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("wav")
        ? "wav"
        : "";

  if (total <= 1) return extension ? `${stem}.${extension}` : original;
  return `${stem}.part${index + 1}of${total}.${extension || "bin"}`;
}
