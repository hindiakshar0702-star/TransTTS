import { test, expect } from "@playwright/test";
import { translationCacheKey } from "../src/lib/translate";
import { ttsCacheKey, VOICES, DEFAULT_VOICE_KEY } from "../src/lib/tts";

/**
 * Cache-key behaviour — the part that decides whether a repeat request costs an
 * upstream call or not. Getting these wrong is expensive in both directions: a
 * key that collides serves the wrong audio, one that varies needlessly never
 * hits and the cache is dead weight.
 */

test.describe("translation cache key", () => {
  test("identical input produces an identical key", () => {
    const a = translationCacheKey("Hello world", "en", "hi");
    const b = translationCacheKey("Hello world", "en", "hi");
    expect(a).toBe(b);
  });

  test("target language is part of the key", () => {
    const hindi = translationCacheKey("Hello world", "en", "hi");
    const tamil = translationCacheKey("Hello world", "en", "ta");
    expect(hindi).not.toBe(tamil);
  });

  test("source language is part of the key", () => {
    expect(translationCacheKey("Hola", "es", "hi")).not.toBe(
      translationCacheKey("Hola", "en", "hi")
    );
  });

  test("text is part of the key, including whitespace differences", () => {
    expect(translationCacheKey("Hello world", "en", "hi")).not.toBe(
      translationCacheKey("Hello  world", "en", "hi")
    );
  });

  test("the key does not leak the source text", () => {
    const secret = "my private message";
    const key = translationCacheKey(secret, "en", "hi");
    expect(key).not.toContain(secret);
    expect(key).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  test("separator cannot be forged by crafted language codes", () => {
    // "en|hi" + text must not collide with a source that embeds the separator.
    expect(translationCacheKey("x", "en", "hi")).not.toBe(
      translationCacheKey("hi|x", "en", "")
    );
  });
});

test.describe("tts cache key", () => {
  const voice = VOICES.get(DEFAULT_VOICE_KEY) as string;

  test("identical request produces an identical key", () => {
    expect(ttsCacheKey("Namaste", voice, 1.0)).toBe(ttsCacheKey("Namaste", voice, 1.0));
  });

  test("voice is part of the key", () => {
    const male = VOICES.get("hi-male") as string;
    expect(ttsCacheKey("Namaste", voice, 1.0)).not.toBe(ttsCacheKey("Namaste", male, 1.0));
  });

  test("speed is part of the key — same words at a different rate is different audio", () => {
    expect(ttsCacheKey("Namaste", voice, 1.0)).not.toBe(ttsCacheKey("Namaste", voice, 1.5));
  });

  test("text is part of the key", () => {
    expect(ttsCacheKey("Namaste", voice, 1.0)).not.toBe(ttsCacheKey("Namaskar", voice, 1.0));
  });

  test("the key does not leak the spoken text", () => {
    const key = ttsCacheKey("account number 1234", voice, 1.0);
    expect(key).not.toContain("1234");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});

test.describe("voice allow-list", () => {
  test("every configured voice maps to a real Neural voice id", () => {
    for (const [key, value] of VOICES) {
      expect(value, `${key} should map to a Neural voice`).toMatch(/Neural$/);
    }
  });

  test("the default voice exists in the map", () => {
    expect(VOICES.has(DEFAULT_VOICE_KEY)).toBe(true);
  });
});
