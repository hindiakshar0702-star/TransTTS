import { test, expect } from "@playwright/test";
import { computeHighlightIndex, cleanToWords, isFuzzyMatch } from "../src/lib/teleprompterMatch";

/**
 * Teleprompter word-highlight matching — pure-logic tests (no browser/mic).
 *
 * Reproduces the reported bug: script "Welcome to the ... landing", where the
 * highlight started on "Welcome" then jumped ahead skipping the short words
 * "to" and "the". These tests assert the fixed sequential matcher visits every
 * word in order and never skips a word silently.
 */

const SCRIPT = "Welcome to the my first landing page transtts.";
const CW = cleanToWords(SCRIPT);
// ["welcome","to","the","my","first","landing","page","transtts"]

test("script cleans to the expected word list", () => {
  expect(CW).toEqual(["welcome", "to", "the", "my", "first", "landing", "page", "transtts"]);
});

test("reported bug: 'Welcome to the' reaches 'the' (index 2), never stuck on 'Welcome'", () => {
  // Engine merges all three into one recognition event.
  const idx = computeHighlightIndex(CW, -1, ["welcome", "to", "the"]);
  expect(idx).toBe(2); // old capped matcher returned 0 (stuck on "welcome")
});

test("incremental interim: highlight advances exactly one word per step, no skips", () => {
  // Simulate cumulative interim transcripts as the user speaks word by word.
  const interims = [
    ["welcome"],
    ["welcome", "to"],
    ["welcome", "to", "the"],
    ["welcome", "to", "the", "my"],
    ["welcome", "to", "the", "my", "first"],
    ["welcome", "to", "the", "my", "first", "landing"],
  ];
  let idx = -1;
  const visited: number[] = [];
  for (const words of interims) {
    idx = computeHighlightIndex(CW, idx, words);
    visited.push(idx);
  }
  // Every short word ("to"=1, "the"=2) is visited; strictly +1 each step.
  expect(visited).toEqual([0, 1, 2, 3, 4, 5]);
});

test("engine drops a short word: pointer moves past it, never stuck", () => {
  // Web Speech API dropped "to" entirely; only "welcome" then "the" arrive.
  const idx = computeHighlightIndex(CW, -1, ["welcome", "the"]);
  // Recovers via lookahead to "the" (2); "to" (1) is passed (rendered completed),
  // not left as the permanent stuck position.
  expect(idx).toBe(2);
  expect(idx).toBeGreaterThan(1);
});

test("never jumps backward on stale/echoed transcripts", () => {
  const idx = computeHighlightIndex(CW, 5, ["welcome", "to", "the"]);
  expect(idx).toBe(5);
});

test("noise / mis-transcription does not advance the pointer", () => {
  const idx = computeHighlightIndex(CW, 0, ["zzxq", "qwerty"]);
  expect(idx).toBe(0);
});

test("short words require an exact match (no fuzzy skip-ahead)", () => {
  // "to" must not fuzzy-match "the"; only its exact slot advances.
  expect(isFuzzyMatch("to", "the")).toBe(false);
  expect(isFuzzyMatch("to", "to")).toBe(true);
  // longer word tolerates a small mis-transcription
  expect(isFuzzyMatch("landin", "landing")).toBe(true);
});

test("full perfect recognition walks to the last word", () => {
  const idx = computeHighlightIndex(CW, -1, [...CW]);
  expect(idx).toBe(CW.length - 1);
});

/* ------------------------------------------------------------------------ *
 * Delta-feeding (createUtteranceFeed) — the component-level part of the fix.
 * Web Speech interim transcripts are CUMULATIVE per utterance; re-feeding
 * them let a stale short word lookahead-match a duplicate script word ahead,
 * which is the reported "highlight jumps forward breaking sequence" bug.
 * ------------------------------------------------------------------------ */

import { createUtteranceFeed } from "../src/lib/teleprompterMatch";

test("delta feed: cumulative interims surface each spoken word exactly once", () => {
  const feed = createUtteranceFeed();
  expect(feed.interim(["welcome"])).toEqual(["welcome"]);
  expect(feed.interim(["welcome", "to"])).toEqual(["to"]);
  expect(feed.interim(["welcome", "to", "the"])).toEqual(["the"]);
  // Final repeats the whole utterance — nothing new to surface.
  expect(feed.final(["welcome", "to", "the"])).toEqual([]);
  // Next utterance starts fresh.
  expect(feed.interim(["my"])).toEqual(["my"]);
});

test("delta feed: final surfaces words the interim never delivered", () => {
  const feed = createUtteranceFeed();
  expect(feed.interim(["welcome", "to"])).toEqual(["welcome", "to"]);
  // Engine finalized with an extra word the interim never showed.
  expect(feed.final(["welcome", "to", "the"])).toEqual(["the"]);
});

test("delta feed: interim revision (shrunk) surfaces nothing", () => {
  const feed = createUtteranceFeed();
  feed.interim(["welcome", "to", "the"]);
  expect(feed.interim(["welcome", "two"])).toEqual([]); // revision, not growth
});

test("regression: duplicate script words — re-feeding jumps, delta-feeding does not", () => {
  // Script repeats "the": a stale re-fed "the" can lookahead-match the SECOND
  // "the" and skip "transtts page" entirely.
  const script = "welcome to the transtts the best page";
  const cw = cleanToWords(script);

  // OLD behavior (bug): feed full cumulative interim each event.
  let buggyIdx = -1;
  for (const words of [
    ["welcome"],
    ["welcome", "to"],
    ["welcome", "to", "the"],
    ["welcome", "to", "the", "transtts"],
  ]) {
    buggyIdx = computeHighlightIndex(cw, buggyIdx, words);
  }
  // The stale "the" (fed again in event 4) matches the second "the" (index 4)
  // via lookahead — the pointer has jumped PAST "transtts" (index 3).
  expect(buggyIdx).toBeGreaterThan(3); // demonstrates why re-feeding is broken

  // NEW behavior: identical events through the delta feeder.
  const feed = createUtteranceFeed();
  let idx = -1;
  const visited: number[] = [];
  for (const words of [
    ["welcome"],
    ["welcome", "to"],
    ["welcome", "to", "the"],
    ["welcome", "to", "the", "transtts"],
  ]) {
    const fresh = feed.interim(words);
    if (fresh.length) idx = computeHighlightIndex(cw, idx, fresh);
    visited.push(idx);
  }
  // Strict one-word-per-step sequence: no jump past "transtts".
  expect(visited).toEqual([0, 1, 2, 3]);
});

test("user case end-to-end: 'Welcome to the my first landing page transtts.' word by word", () => {
  const cw = cleanToWords("Welcome to the my first landing page transtts.");
  const feed = createUtteranceFeed();
  const cumulative: string[] = [];
  let idx = -1;
  const visited: number[] = [];
  for (const w of cw) {
    cumulative.push(w);
    const fresh = feed.interim([...cumulative]);
    if (fresh.length) idx = computeHighlightIndex(cw, idx, fresh);
    visited.push(idx);
  }
  // Every word highlights individually, in order, no jumps:
  expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // Final transcript for the utterance adds nothing (already all surfaced).
  expect(feed.final(cw)).toEqual([]);
});
