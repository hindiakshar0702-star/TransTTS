import { test, expect } from "@playwright/test";
import { chunkForTranslation, MAX_CHUNK_CHARS } from "../src/lib/translate";

/**
 * Chunking for translation. The old implementation sliced every 4500 characters
 * with `substring`, cutting through whichever word sat on the boundary, so the
 * translator received two fragments and produced a visible error at every
 * boundary of a long document.
 *
 * The assertion that matters is therefore about what is NOT broken: no chunk
 * may begin or end mid-word, and no content may be lost.
 */

const sentence = (n: number) => `This is sentence number ${n} and it says something.`;

/** Rebuild the input from chunks, ignoring whitespace differences. */
const words = (s: string) => s.split(/\s+/).filter(Boolean);

test("short text is returned as a single chunk", () => {
  const text = "Hello world.";
  expect(chunkForTranslation(text)).toEqual([text]);
});

test("empty or whitespace-only text produces no chunks", () => {
  expect(chunkForTranslation("")).toEqual([]);
  expect(chunkForTranslation("   \n  ")).toEqual([]);
});

test("every chunk stays within the limit", () => {
  const text = Array.from({ length: 400 }, (_, i) => sentence(i)).join(" ");
  for (const chunk of chunkForTranslation(text)) {
    expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  }
});

test("no word is split across chunks", () => {
  const text = Array.from({ length: 400 }, (_, i) => sentence(i)).join(" ");
  const chunks = chunkForTranslation(text);
  expect(chunks.length).toBeGreaterThan(1); // ensure the split actually happened

  // Every word of the output must be a word of the input — a split word would
  // produce fragments that never appear in the original.
  const original = new Set(words(text));
  for (const chunk of chunks) {
    for (const w of words(chunk)) {
      expect(original.has(w), `"${w}" is not a word from the source`).toBe(true);
    }
  }
});

test("no content is lost when splitting", () => {
  const text = Array.from({ length: 400 }, (_, i) => sentence(i)).join(" ");
  const rejoined = words(chunkForTranslation(text).join(" "));
  expect(rejoined).toEqual(words(text));
});

test("chunks break at sentence boundaries, not mid-sentence", () => {
  const text = Array.from({ length: 400 }, (_, i) => sentence(i)).join(" ");
  const chunks = chunkForTranslation(text);

  // Every chunk except possibly the last should end at a sentence terminator.
  for (const chunk of chunks.slice(0, -1)) {
    expect(chunk.trimEnd(), `chunk should end a sentence: ...${chunk.slice(-40)}`).toMatch(
      /[.!?।॥。！？]$/
    );
  }
});

test("Hindi danda is treated as a sentence boundary", () => {
  const hindi = Array.from({ length: 300 }, () => "यह एक परीक्षण वाक्य है।").join(" ");
  const chunks = chunkForTranslation(hindi);
  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks.slice(0, -1)) {
    expect(chunk.trimEnd()).toMatch(/[।॥]$/);
  }
});

test("a single sentence longer than the limit falls back to word boundaries", () => {
  // One enormous sentence with no terminator until the very end.
  const longSentence = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(" ") + ".";
  const chunks = chunkForTranslation(longSentence);

  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) {
    expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  }
  // Still no broken words.
  const original = new Set(words(longSentence));
  for (const chunk of chunks) {
    for (const w of words(chunk)) expect(original.has(w)).toBe(true);
  }
});

test("a single token longer than the limit is hard-sliced as a last resort", () => {
  // No spaces and no terminators — there is no boundary left to respect.
  const giant = "a".repeat(MAX_CHUNK_CHARS * 2 + 100);
  const chunks = chunkForTranslation(giant);

  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) {
    expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  }
  expect(chunks.join("")).toBe(giant); // nothing dropped
});

test("regression: the old fixed-width slice broke words, this does not", () => {
  // Build text where a fixed 4500-char cut lands inside a word.
  const filler = "x".repeat(MAX_CHUNK_CHARS - 10);
  const text = `${filler} supercalifragilistic word here. And a second sentence.`;

  const oldWay = [text.substring(0, MAX_CHUNK_CHARS), text.substring(MAX_CHUNK_CHARS)];
  expect(oldWay[0].endsWith("supercalifragilistic")).toBe(false); // proves the old cut split it

  const original = new Set(words(text));
  for (const chunk of chunkForTranslation(text)) {
    for (const w of words(chunk)) expect(original.has(w)).toBe(true);
  }
});
