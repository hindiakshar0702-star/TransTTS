/**
 * Shared text-translation utility (MyMemory free API) — used by the
 * /api/translate route and the social-transcribe pipeline's English→Hindi step.
 * Node-only (network I/O).
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

  const langPair = encodeURIComponent(`${src}|${targetLang}`);
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 4500) {
    chunks.push(text.substring(i, i + 4500));
  }

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

  return { ok: true, text: translated.join(" ") };
}
