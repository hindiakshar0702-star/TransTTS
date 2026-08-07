import { createHash } from "crypto";
import prisma from "@/lib/prisma";

/**
 * Shared text-translation utility (MyMemory free API) — used by the
 * /api/translate route and the social-transcribe pipeline's English→Hindi step.
 * Node-only (network I/O, database).
 *
 * Results are cached. Translation is deterministic for a given
 * (text, source, target), and MyMemory's free tier has a small daily quota, so
 * re-translating text the service has already seen wastes both quota and the
 * user's time. Only a hash of the input and the result are stored — the source
 * text never lands in the cache table.
 */

const LANG_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

export function isValidLangCode(code: string): boolean {
  return LANG_RE.test(code);
}

export interface TranslateOutcome {
  ok: boolean;
  text: string;
  /** Upstream failure detail (safe to show users) when ok=false. */
  detail?: string;
  /** True when the result came from the cache instead of the upstream API. */
  cached?: boolean;
}

/**
 * Cache key for a translation request. Hashing means the cache table holds no
 * readable source text, and it keeps the primary key a fixed size regardless of
 * how long the input was.
 */
export function translationCacheKey(text: string, src: string, target: string): string {
  return createHash("sha256").update(`${src}|${target}|${text}`).digest("hex");
}

/** MyMemory rejects very long queries, so requests are split before sending. */
export const MAX_CHUNK_CHARS = 4500;

/**
 * Sentence terminators, including the ones this app actually needs: the
 * Devanagari danda used by Hindi and Marathi, and the full-width stops used by
 * Chinese and Japanese. Kept in a character class so the terminator stays
 * attached to the sentence it ends.
 */
const SENTENCE_END = /(?<=[.!?।॥。！？])\s+/;

/**
 * Split `text` into pieces small enough to translate, breaking at the largest
 * natural boundary available.
 *
 * The previous implementation sliced every 4500 characters with `substring`,
 * which cut through whichever word happened to sit on the boundary. Each cut
 * handed the translator two word fragments and produced a visible error at
 * every boundary of a long document.
 *
 * Preference order: sentence, then word, and only for a single "word" longer
 * than the limit — a URL, or a script that does not space its words — a hard
 * slice, because at that point there is no boundary left to respect.
 */
export function chunkForTranslation(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return text.trim() ? [text] : [];

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current);
    current = "";
  };

  for (const sentence of text.split(SENTENCE_END)) {
    // Sentence fits in the chunk being built — keep packing.
    if (current.length + sentence.length + 1 <= maxChars) {
      current = current ? `${current} ${sentence}` : sentence;
      continue;
    }

    push();

    if (sentence.length <= maxChars) {
      current = sentence;
      continue;
    }

    // One sentence is over the limit: fall back to word boundaries.
    for (const word of sentence.split(/\s+/)) {
      if (current.length + word.length + 1 <= maxChars) {
        current = current ? `${current} ${word}` : word;
        continue;
      }

      push();

      if (word.length <= maxChars) {
        current = word;
        continue;
      }

      // A single token longer than the limit. Nothing left to break on.
      for (let i = 0; i < word.length; i += maxChars) {
        const slice = word.slice(i, i + maxChars);
        if (slice.length === maxChars) chunks.push(slice);
        else current = slice;
      }
    }
  }

  push();
  return chunks;
}

/**
 * Translate `text` from `sourceLang` to `targetLang` in 4.5k chunks via
 * MyMemory. Returns ok=false with a safe detail message on upstream failure
 * instead of throwing, so callers can degrade gracefully (e.g. keep the
 * untranslated transcript).
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslateOutcome> {
  const src = sourceLang === "auto" || !sourceLang ? "en" : sourceLang;
  if (!isValidLangCode(src) || !isValidLangCode(targetLang)) {
    return { ok: false, text: "", detail: "invalid language code" };
  }

  // Cache hit: skip the upstream call entirely. A cache failure must never
  // block a translation, so every cache interaction is best-effort.
  const cacheKey = translationCacheKey(text, src, targetLang);
  try {
    const hit = await prisma.translationCache.findUnique({ where: { key: cacheKey } });
    if (hit) {
      void prisma.translationCache
        .update({
          where: { key: cacheKey },
          data: { lastUsedAt: new Date(), hitCount: { increment: 1 } },
        })
        .catch(() => {});
      return { ok: true, text: hit.translatedText, cached: true };
    }
  } catch (err) {
    console.error("[translate] cache read failed:", err);
  }

  const langPair = encodeURIComponent(`${src}|${targetLang}`);
  const chunks = chunkForTranslation(text);

  const translated: string[] = [];
  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      const data = await res.json();

      // MyMemory returns responseStatus as a number OR a string.
      if (Number(data.responseStatus) === 200 && data.responseData?.translatedText) {
        translated.push(data.responseData.translatedText);
      } else {
        const detail =
          typeof data.responseDetails === "string" && data.responseDetails
            ? data.responseDetails
            : "the translation service is temporarily unavailable";
        return { ok: false, text: "", detail };
      }
    } catch {
      return { ok: false, text: "", detail: "the translation service timed out" };
    }
  }

  const result = translated.join(" ");

  // Store for next time. Concurrent requests for the same text can race here,
  // so an existing key is treated as success rather than an error.
  try {
    await prisma.translationCache.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, translatedText: result, engine: "MyMemory (Free)" },
      update: { lastUsedAt: new Date() },
    });
  } catch (err) {
    console.error("[translate] cache write failed:", err);
  }

  return { ok: true, text: result };
}
