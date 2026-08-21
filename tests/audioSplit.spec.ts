import { test, expect } from "@playwright/test";
import { parseMp3Frames, splitMp3, looksLikeMp3, partFileName } from "../src/lib/audioSplit";

/**
 * Splitting audio so it fits the host's per-request limit.
 *
 * The property that matters is that every piece is still a *file*. Slicing a
 * compressed stream at an arbitrary byte offset produces something no decoder
 * will open and the API rejects at its magic-number check, so these tests are
 * mostly about boundaries landing where they should and nothing being lost.
 */

/** MPEG1 Layer III, 128 kbps, 44.1 kHz: 417 bytes and 26.12 ms per frame. */
const FRAME_BYTES = 417;

function mp3Frame(fill = 0x55): Uint8Array {
  const frame = new Uint8Array(FRAME_BYTES).fill(fill);
  frame[0] = 0xff;
  frame[1] = 0xfb; // MPEG1, Layer III, no CRC
  frame[2] = 0x90; // bitrate index 9 (128k), rate index 0 (44.1k), no padding
  frame[3] = 0x00;
  return frame;
}

function mp3File(frameCount: number, id3Bytes = 0): Uint8Array {
  const audio = new Uint8Array(frameCount * FRAME_BYTES);
  for (let i = 0; i < frameCount; i++) audio.set(mp3Frame(i & 0xff), i * FRAME_BYTES);
  if (id3Bytes === 0) return audio;

  // ID3v2 header: "ID3", version, flags, then a synchsafe size.
  const size = id3Bytes - 10;
  const out = new Uint8Array(id3Bytes + audio.length);
  out.set([0x49, 0x44, 0x33, 3, 0, 0], 0);
  out[6] = (size >> 21) & 0x7f;
  out[7] = (size >> 14) & 0x7f;
  out[8] = (size >> 7) & 0x7f;
  out[9] = size & 0x7f;
  out.set(audio, id3Bytes);
  return out;
}

test.describe("MP3 frame parsing", () => {
  test("finds every frame and measures it", () => {
    const frames = parseMp3Frames(mp3File(50));
    expect(frames).toHaveLength(50);
    expect(frames.every((f) => f.length === FRAME_BYTES)).toBe(true);
    // 1152 samples at 44.1 kHz.
    expect(frames[0].seconds).toBeCloseTo(1152 / 44100, 6);
  });

  test("skips an ID3v2 tag rather than parsing it as audio", () => {
    const tagged = mp3File(20, 2048);
    const frames = parseMp3Frames(tagged);
    expect(frames).toHaveLength(20);
    // The first frame starts after the tag, not at byte zero.
    expect(frames[0].offset).toBe(2048);
  });

  test("recognises both MP3 openings, and rejects other containers", () => {
    expect(looksLikeMp3(mp3File(1))).toBe(true);
    expect(looksLikeMp3(mp3File(1, 1024))).toBe(true);
    // EBML — a WebM recording, which must take the decode path instead.
    expect(looksLikeMp3(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(false);
    expect(looksLikeMp3(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false); // "RIFF"
  });
});

test.describe("MP3 splitting", () => {
  test("every part stays under the limit and starts on a frame header", async () => {
    const total = 300;
    const maxBytes = 40 * FRAME_BYTES;
    const parts = splitMp3(mp3File(total), maxBytes);

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.blob.size).toBeLessThanOrEqual(maxBytes);
      const head = new Uint8Array(await part.blob.slice(0, 2).arrayBuffer());
      expect(head[0]).toBe(0xff);
      expect(head[1] & 0xe0).toBe(0xe0);
    }
  });

  test("loses no audio: the parts rejoin into the original stream", async () => {
    const original = mp3File(137);
    const parts = splitMp3(original, 30 * FRAME_BYTES);

    const chunks: Uint8Array[] = [];
    for (const part of parts) chunks.push(new Uint8Array(await part.blob.arrayBuffer()));
    const rejoined = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) { rejoined.set(c, at); at += c.length; }

    expect(rejoined.length).toBe(original.length);
    expect(Buffer.from(rejoined).equals(Buffer.from(original))).toBe(true);
  });

  test("part durations add up to the whole", () => {
    const parts = splitMp3(mp3File(200), 30 * FRAME_BYTES);
    const totalSeconds = parts.reduce((s, p) => s + p.seconds, 0);
    expect(totalSeconds).toBeCloseTo(200 * (1152 / 44100), 5);
  });

  test("declines non-MP3 input instead of returning garbage", () => {
    // A caller that got [] must fall back to decoding, not upload nothing.
    expect(splitMp3(new Uint8Array(4096), 1024)).toEqual([]);
  });
});

test.describe("part naming", () => {
  test("labels parts and matches the extension to the bytes", () => {
    expect(partFileName("talk.webm", 0, 3, "audio/wav")).toBe("talk.part1of3.wav");
    expect(partFileName("talk.mp3", 2, 3, "audio/mpeg")).toBe("talk.part3of3.mp3");
  });

  test("a single part keeps a plain name", () => {
    expect(partFileName("talk.mp3", 0, 1, "audio/mpeg")).toBe("talk.mp3");
  });

  test("survives a name with no extension", () => {
    expect(partFileName("voicenote", 0, 2, "audio/wav")).toBe("voicenote.part1of2.wav");
  });
});
