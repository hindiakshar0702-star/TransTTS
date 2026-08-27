import { test, expect } from "@playwright/test";
import { languageCodeFromName, LANGUAGES, TRANSCRIPT_CONTEXT_CHARS } from "../src/lib/utils";

/**
 * Keeping a split transcript in one language.
 *
 * Whisper reports the language it detected as a *name* ("Indonesian") but its
 * request parameter takes a *code* ("id"). A file sent as several parts has to
 * carry the first part's answer forward, or every part is detected on its own —
 * and a part that guesses wrong does not fail, it transcribes the speech
 * phonetically into the language it guessed. That is how an Indonesian
 * recording comes back with English sentences spliced into the middle of it.
 *
 * The lookup returning null is a normal outcome, not an error: Whisper knows
 * far more languages than this app lists. The caller must fall back to
 * auto-detection there rather than sending a bad code.
 */

test.describe("detected language to request code", () => {
  test("resolves the names Whisper actually returns", () => {
    expect(languageCodeFromName("Indonesian")).toBe("id");
    expect(languageCodeFromName("English")).toBe("en");
    expect(languageCodeFromName("Hindi")).toBe("hi");
    expect(languageCodeFromName("Marathi")).toBe("mr");
  });

  test("ignores the case and padding the two engines differ on", () => {
    // OpenAI answers "english", Groq answers "English".
    expect(languageCodeFromName("english")).toBe("en");
    expect(languageCodeFromName("  Hindi  ")).toBe("hi");
  });

  test("declines anything it cannot map, so the caller stays on auto", () => {
    expect(languageCodeFromName("Swahili")).toBeNull();
    expect(languageCodeFromName("")).toBeNull();
    expect(languageCodeFromName("   ")).toBeNull();
    expect(languageCodeFromName("not a language")).toBeNull();
  });

  test("never resolves to the auto sentinel", () => {
    // "auto" lives in the same map but is a UI choice, not a language. Pinning
    // a part to it would silently undo the whole point.
    expect(languageCodeFromName("Auto Detect")).toBeNull();
  });

  test("round-trips every real language in the list", () => {
    for (const [code, entry] of Object.entries(LANGUAGES)) {
      if (code === "auto") continue;
      expect(languageCodeFromName(entry.name)).toBe(code);
    }
  });
});

test.describe("context window", () => {
  test("stays inside Whisper's prompt allowance", () => {
    // The prompt field is capped near 224 tokens; anything past that is
    // dropped, and a long tail would push out the part that matters.
    expect(TRANSCRIPT_CONTEXT_CHARS).toBeGreaterThan(100);
    expect(TRANSCRIPT_CONTEXT_CHARS).toBeLessThanOrEqual(900);
  });

  test("a tail is taken from the end, where the sentence continues", () => {
    const transcript = "A".repeat(2000) + "the last thing said";
    const tail = transcript.slice(-TRANSCRIPT_CONTEXT_CHARS);
    expect(tail.endsWith("the last thing said")).toBe(true);
    expect(tail.length).toBe(TRANSCRIPT_CONTEXT_CHARS);
  });
});
