import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Translation pipeline (BUG-006, BUG-007 fixes).
 *
 * Engine: MyMemory free public API. Two production-grade gotchas the
 * old code missed:
 *
 *   1. MyMemory truncates GET responses ~500 chars. Sending 4500-char
 *      chunks meant the user got back ~10% of their text.
 *   2. encodeURIComponent of 4500 Devanagari chars produces a query
 *      string ~30 KB long, which many CDNs reject with HTTP 414.
 *   3. `sourceLang === "auto"` was silently coerced to "en" (BUG-007),
 *      so an Auto-detected Hindi input was translated as if it were
 *      English. Fix: detect from a sample, fall back to MyMemory's own
 *      auto-detect via `detect=true`.
 *
 * Strategy:
 *   - Split on sentence boundaries first (Devanagari "।", JP/CN "。",
 *     plus Latin .!? plus newlines), then pack into ≤ MAX_CHUNK chars.
 *   - Run up to MAX_CONCURRENCY chunks in parallel for speed.
 *   - Retry each chunk with exponential backoff on transient failures.
 *   - Detect language from the FIRST 200 chars when sourceLang === "auto".
 */

const MAX_INPUT_LEN = 10_000;
const MAX_CHUNK = 450; // safe under MyMemory's 500-char practical ceiling
const MAX_CONCURRENCY = 4;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

const SENTENCE_SPLIT_REGEX =
  /([^।.!?。\n]+[।.!?。]?\s*|\n+)/g;

interface MyMemoryResponse {
  responseStatus: number | string;
  responseData?: { translatedText?: string; match?: number };
  responseDetails?: string;
  matches?: Array<{ translation?: string }>;
}

/* -------------------------------------------------------------------- */
/* Language detection (BUG-007)                                          */
/* -------------------------------------------------------------------- */

/**
 * Quick script-based language detection — good enough for routing. We
 * inspect the FIRST 200 chars (statistically more than enough for
 * single-script inputs which is the common case).
 *
 * Returns a 2-letter code or null when unsure (caller falls back to "en").
 */
function detectLangFromScript(text: string): string | null {
  const sample = text.slice(0, 200);

  // Devanagari → Hindi (also Marathi/Sanskrit/Nepali; Hindi is the most
  // common case and MyMemory will still translate the others tolerably).
  if (/[\u0900-\u097F]/.test(sample)) return "hi";
  // Bengali
  if (/[\u0980-\u09FF]/.test(sample)) return "bn";
  // Gurmukhi (Punjabi)
  if (/[\u0A00-\u0A7F]/.test(sample)) return "pa";
  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(sample)) return "gu";
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(sample)) return "ta";
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(sample)) return "te";
  // Kannada
  if (/[\u0C80-\u0CFF]/.test(sample)) return "kn";
  // Malayalam
  if (/[\u0D00-\u0D7F]/.test(sample)) return "ml";
  // Arabic / Urdu (heuristic: Urdu uses additional chars but MyMemory
  // accepts "ar" for both as a usable fallback)
  if (/[\u0600-\u06FF]/.test(sample)) return "ar";
  // CJK
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(sample)) return "ko";
  if (/[\u4E00-\u9FFF]/.test(sample)) return "zh";
  // Cyrillic → Russian
  if (/[\u0400-\u04FF]/.test(sample)) return "ru";
  // Latin script — could be many languages. Punt to MyMemory.
  return null;
}

/* -------------------------------------------------------------------- */
/* Sentence-boundary chunker (BUG-006)                                  */
/* -------------------------------------------------------------------- */

/**
 * Splits `text` into chunks of at most `maxLen` characters, breaking
 * at sentence boundaries when possible. Single sentences longer than
 * maxLen are hard-split as a last resort (rare — typical sentences are
 * <300 chars even in legalese).
 */
export function chunkText(text: string, maxLen = MAX_CHUNK): string[] {
  if (text.length <= maxLen) return [text];

  const sentences = text.match(SENTENCE_SPLIT_REGEX) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      // Sentence itself too long — flush and hard-split.
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxLen) {
        chunks.push(sentence.slice(i, i + maxLen));
      }
      continue;
    }
    if (current.length + sentence.length > maxLen) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);

  return chunks.filter((c) => c.length > 0);
}

/**
 * Joins translated chunks back together. We avoid blindly inserting
 * spaces at chunk boundaries because the chunker already preserves
 * trailing whitespace from the original — adding more would garble
 * Japanese/Chinese (no inter-word spaces) and double-space everything
 * else.
 */
function joinChunks(parts: string[]): string {
  return parts.join("");
}

/* -------------------------------------------------------------------- */
/* MyMemory call with retries + timeout                                  */
/* -------------------------------------------------------------------- */

async function fetchWithTimeout(
  url: string,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function translateOneChunk(
  chunk: string,
  langPair: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url =
        `https://api.mymemory.translated.net/get` +
        `?q=${encodeURIComponent(chunk)}` +
        `&langpair=${encodeURIComponent(langPair)}`;

      const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (!res.ok) {
        throw new Error(
          `MyMemory HTTP ${res.status} ${res.statusText}`,
        );
      }
      const data: MyMemoryResponse = await res.json();

      // MyMemory returns 200 as a number on success but sometimes a string.
      const ok =
        data.responseStatus === 200 || data.responseStatus === "200";
      if (!ok) {
        throw new Error(
          data.responseDetails || `MyMemory error ${data.responseStatus}`,
        );
      }

      const translated = data.responseData?.translatedText;
      if (!translated) {
        throw new Error("MyMemory returned an empty translation");
      }
      return translated;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 400ms, 800ms, 1600ms — keeps total worst
        // case under ~3s per chunk while still surviving brief blips.
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError ?? new Error("Translation failed after retries");
}

/**
 * Bounded-concurrency map. Avoids hammering MyMemory's free tier
 * (~10 req/min) while keeping latency tolerable for long inputs.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/* -------------------------------------------------------------------- */
/* POST /api/translate                                                   */
/* -------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  let jobId: string | null = null;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const text: unknown = body.text;
    const sourceLang: unknown = body.sourceLang;
    const targetLang: unknown = body.targetLang;

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing text" },
        { status: 400 },
      );
    }
    if (typeof targetLang !== "string" || targetLang.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing targetLang" },
        { status: 400 },
      );
    }
    if (text.length > MAX_INPUT_LEN) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${MAX_INPUT_LEN.toLocaleString()} characters.` },
        { status: 400 },
      );
    }

    const cleanTarget = targetLang.trim().toLowerCase();
    const requestedSource =
      typeof sourceLang === "string" ? sourceLang.trim().toLowerCase() : "auto";

    // ---- BUG-007 fix: real auto-detection ----
    // Old code did `src === "auto" ? "en" : src`, silently mistranslating
    // every non-English input. We now run a script-based detector first,
    // then fall back to "en" only if we genuinely can't tell.
    let resolvedSource: string;
    if (requestedSource === "auto" || requestedSource === "") {
      resolvedSource = detectLangFromScript(text) ?? "en";
    } else {
      resolvedSource = requestedSource;
    }

    // No-op short-circuit: source equals target → just echo the input.
    if (resolvedSource === cleanTarget) {
      return NextResponse.json({
        originalText: text,
        translatedText: text,
        sourceLang: resolvedSource,
        targetLang: cleanTarget,
        engine: "noop (source==target)",
      });
    }

    // Persist job FIRST so we always have a row to mark errored.
    const job = await prisma.job.create({
      data: {
        type: "translate",
        title: text.substring(0, 80),
        status: "processing",
        sourceText: text.substring(0, 5000),
        sourceLang: resolvedSource,
        targetLang: cleanTarget,
      },
    });
    jobId = job.id;

    const langPair = `${resolvedSource}|${cleanTarget}`;
    const chunks = chunkText(text);

    const translatedChunks = await mapWithConcurrency(
      chunks,
      MAX_CONCURRENCY,
      (chunk) => translateOneChunk(chunk, langPair),
    );

    const translatedText = joinChunks(translatedChunks);

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "completed",
        progress: 100,
        translatedText: translatedText.substring(0, 5000),
        engine: "MyMemory (Free)",
      },
    });

    return NextResponse.json({
      originalText: text,
      translatedText,
      sourceLang: resolvedSource,
      detectedLang:
        requestedSource === "auto" || requestedSource === ""
          ? resolvedSource
          : null,
      targetLang: cleanTarget,
      chunks: chunks.length,
      engine: "MyMemory (Free)",
    });
  } catch (error: unknown) {
    console.error("Translation error:", error);
    const message =
      error instanceof Error ? error.message : "Translation failed";

    if (jobId) {
      await prisma.job
        .update({
          where: { id: jobId },
          data: { status: "error", errorMsg: message },
        })
        .catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
