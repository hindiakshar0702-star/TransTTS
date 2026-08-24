import OpenAI from "openai";
import { LANGUAGES } from "@/lib/utils";

/**
 * Text translation via Groq's free-tier LLMs. Node-only (network I/O).
 *
 * This used to call MyMemory's keyless endpoint, but MyMemory does not machine
 * translate — it returns the closest entry from a user-contributed translation
 * memory. In practice that meant "Good morning" came back as "don't say good
 * night to me" and "Thank you very much" came back empty. Picking a different
 * match from its response did not fix it either; the data itself is unreliable.
 *
 * Groq needs no extra account: the same GROQ_API_KEY that powers transcription
 * is used here, still on the free tier.
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
}

/**
 * How much of the previous chunk's translation is shown to the next one, to
 * hold terminology and formality steady across a long document.
 */
const CONTINUITY_CHARS = 400;

/** Long text is split before sending so no single request is unwieldy. */
export const MAX_CHUNK_CHARS = 4500;

/**
 * Groq model used for translation. Overridable so a deprecated model id can be
 * swapped through env without a redeploy of the code.
 *
 * gpt-oss-120b was picked by measuring the alternatives on this account:
 * qwen3.6-27b leaks its `<think>` block into the reply, and gpt-oss-20b is
 * faster but slightly looser on longer passages.
 */
const TRANSLATE_MODEL = process.env.GROQ_TRANSLATE_MODEL || "openai/gpt-oss-120b";

/**
 * Human-readable language name for the prompt — LLMs handle names, not ISO
 * codes. `code` reaches this from the request body, so the lookup is guarded
 * against inherited keys ("constructor", "__proto__") rather than indexing the
 * map directly.
 */
function languageName(code: string): string {
  if (!Object.prototype.hasOwnProperty.call(LANGUAGES, code)) return code;
  return LANGUAGES[code]?.name ?? code;
}

function getGroqClient(): OpenAI | null {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "your-groq-api-key-here") return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
}

/**
 * Strip the wrappers an LLM sometimes adds around a translation despite being
 * told not to — a "Translation:" label, or quotes around the whole answer.
 *
 * The `<think>` case is for GROQ_TRANSLATE_MODEL overrides: the default model
 * keeps its reasoning in a separate field, but several others on Groq emit it
 * inline and would otherwise ship a monologue to the user.
 */
function cleanOutput(raw: string): string {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  out = out.replace(/^(translation|translated text|output)\s*:\s*/i, "").trim();
  if (out.length > 1 && /^["'“”]/.test(out) && /["'“”]$/.test(out)) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

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
 * Translate `text` from `sourceLang` to `targetLang`, chunked at sentence
 * boundaries. Returns ok=false with a safe detail message on failure instead of
 * throwing, so callers can degrade gracefully (e.g. keep the original text).
 *
 * `sourceLang` may be "auto" — the model infers it rather than being told.
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslateOutcome> {
  const isAuto = sourceLang === "auto" || !sourceLang;
  const src = isAuto ? "auto" : sourceLang;
  if ((!isAuto && !isValidLangCode(src)) || !isValidLangCode(targetLang)) {
    return { ok: false, text: "", detail: "invalid language code" };
  }

  const client = getGroqClient();
  if (!client) {
    return { ok: false, text: "", detail: "translation is not configured on this server" };
  }

  const target = languageName(targetLang);
  const from = isAuto ? "the source language (detect it)" : languageName(src);

  const system =
    `You are a translation engine. Translate the user's text from ${from} into natural, idiomatic ${target}. ` +
    `Reply with the translation ONLY — no preamble, no notes, no quotes around it. ` +
    // A transcript of a conversation often carries more than one language, and
    // "translate from X" on its own leaves the other one sitting there.
    `The text may switch language mid-way or mix several languages in one sentence. ` +
    `Translate all of it into ${target}, whatever language each part is in. ` +
    // "Preserve proper nouns" used to send kinship and address terms through
    // untouched, because they are capitalised: Indonesian "Ibu" (mother) came
    // back as the name "Ibu" rather than as the word for mother.
    `Keep only genuine names — people, places, brands — as they are. Everyday words are not names ` +
    `even when capitalised, so forms of address and kinship terms must be translated into what ${target} ` +
    `speakers actually call that person, not spelled out phonetically. ` +
    `Write it the way a ${target} speaker would say it rather than word for word, and keep one consistent ` +
    `choice of wording and level of formality for a given person or term throughout. ` +
    `Preserve line breaks and numbers. ` +
    // Most input here is a Whisper transcript rather than written prose, so it
    // arrives without punctuation and with false starts and repeated words.
    // Left unsaid, the model tidies it into an essay and drops content.
    //
    // The final sentence is load-bearing and was arrived at by measurement. An
    // earlier wording — "never omit, summarise or condense, even where that
    // reads worse than a tidied version would" — kept the fillers but was read
    // as licence to leave source words alone, so Indonesian "Ibu" came back
    // transliterated instead of as the word for mother. Over five runs each,
    // that wording scored 0/5 on translating forms of address and this one
    // scores 5/5, with both keeping fillers 5/5.
    `The text is usually a speech transcript. Its fillers, false starts and repeated words are content: ` +
    `translate them too rather than cleaning them up. Keeping content never means keeping a source word ` +
    `untranslated — everything ends up in ${target}. ` +
    // Romanised Hindi came back untouched under the old wording, because it
    // read as "already Hindi".
    `Text in ${target}'s language but written in another script still needs translating — put it into ${target}'s own script. ` +
    `Return a passage unchanged only when it is already in ${target} and in ${target}'s script.`;

  const chunks = chunkForTranslation(text);
  const translated: string[] = [];

  for (const chunk of chunks) {
    // Chunks are separate requests, so without this each one re-decides how to
    // render a recurring name or term and the document drifts: the same "Ibu"
    // arrives as one word early on and another later. Showing the model the end
    // of what it just produced keeps those choices stable.
    const previous = translated.length > 0 ? translated[translated.length - 1] : "";
    const continuation = previous
      ? `This continues a translation already in progress. Its last lines read:\n\n` +
        `${previous.slice(-CONTINUITY_CHARS)}\n\n` +
        `Match that wording, formality and terminology. Translate only the new text below.`
      : "";

    try {
      const completion = await client.chat.completions.create(
        {
          model: TRANSLATE_MODEL,
          // Deterministic: translation should not vary run to run.
          temperature: 0,
          // Translation needs no deliberation. Measured on the default model:
          // this drops ~800 reasoning tokens per call to ~25 with identical
          // output, which matters on a free tier billed by tokens per minute.
          reasoning_effort: "low",
          messages: [
            { role: "system", content: continuation ? `${system}\n\n${continuation}` : system },
            { role: "user", content: chunk },
          ],
        },
        { timeout: 45_000 }
      );

      const out = cleanOutput(completion.choices[0]?.message?.content ?? "");
      if (!out) {
        return { ok: false, text: "", detail: "the translation service returned an empty result" };
      }
      translated.push(out);
    } catch (err) {
      console.error("[translate] Groq call failed:", err);
      const raw = err instanceof Error ? err.message : "";
      const lower = raw.toLowerCase();

      let detail = "the translation service is temporarily unavailable";
      if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
        detail = "the translation service is rate limited — please try again shortly";
      } else if (lower.includes("timeout") || lower.includes("aborted")) {
        detail = "the translation service timed out";
      } else if (lower.includes("401") || lower.includes("invalid api key")) {
        detail = "the translation service rejected the API key";
      } else if (
        lower.includes("model") &&
        (lower.includes("decommission") || lower.includes("does not exist") || lower.includes("not_found"))
      ) {
        detail = "the configured translation model is not available";
      }
      return { ok: false, text: "", detail };
    }
  }

  return { ok: true, text: translated.join(" ") };
}
