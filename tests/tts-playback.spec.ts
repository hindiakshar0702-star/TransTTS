import { test, expect } from "@playwright/test";

/**
 * That generated speech can actually be played.
 *
 * This failed silently for as long as the feature existed. /api/tts returned
 * 200 with a valid MP3 every time — the bytes were never the problem — but it
 * returned them as a base64 `data:` URL, and the app's CSP allows media from
 * `'self'` and `blob:` only. Chrome enforced that by refusing the element:
 * `MEDIA_ELEMENT_ERROR: Media load rejected by URL safety check`, readyState
 * stuck at 0, the player showing "0:00 / 0:00". Nothing threw, nothing logged,
 * and an API-level test passes right through it.
 *
 * So the assertion has to be that the *element* loaded, not that the request
 * succeeded.
 */

test.describe("TTS playback", () => {
  test("the CSP permits blob media but not data:, which is why the URL is rewrapped", async ({ page }) => {
    const response = await page.goto("/tts");
    const csp = response?.headers()["content-security-policy"] ?? "";
    const mediaSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("media-src")) ?? "";

    expect(mediaSrc, "media-src must be declared, or this test proves nothing").not.toBe("");
    expect(mediaSrc).toContain("blob:");
    // If data: is ever allowed here the rewrapping becomes optional — but until
    // then, shipping a data: URL to an <audio> element is a silent failure.
    expect(mediaSrc).not.toContain("data:");
  });

  test("a data: URL is turned into something the element will load", async ({ page }) => {
    await page.goto("/tts");

    const result = await page.evaluate(async () => {
      // A real, decodable file, so the only difference between the two attempts
      // is the URL scheme. With a malformed fixture both fail with the same
      // error code and the test proves nothing.
      const sampleRate = 8000;
      const samples = sampleRate / 10; // 100 ms
      const buffer = new ArrayBuffer(44 + samples * 2);
      const view = new DataView(buffer);
      const ascii = (at: number, t: string) => { for (let i = 0; i < t.length; i++) view.setUint8(at + i, t.charCodeAt(i)); };
      ascii(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); ascii(8, "WAVE");
      ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      ascii(36, "data"); view.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++) {
        view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), true);
      }
      const bytes = new Uint8Array(buffer);

      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataUrl = "data:audio/wav;base64," + btoa(binary);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));

      const load = (src: string) =>
        new Promise<string>((resolve) => {
          const el = new Audio();
          el.onerror = () => resolve("rejected:" + (el.error?.code ?? "?"));
          el.onloadedmetadata = () => resolve("loaded");
          setTimeout(() => resolve(el.error ? "rejected:" + el.error.code : "timeout"), 4000);
          el.src = src;
        });

      const viaData = await load(dataUrl);
      const viaBlob = await load(blobUrl);
      URL.revokeObjectURL(blobUrl);
      return { viaData, viaBlob };
    });

    // Identical bytes: the policy refuses one scheme and permits the other.
    expect(result.viaData).toContain("rejected");
    expect(result.viaBlob).toBe("loaded");
  });

  test("the player element is given a blob URL, never the raw data: one", async ({ page }) => {
    await page.goto("/tts");

    // Drive the real page: the element only appears once generation completes.
    await page.locator("textarea").first().fill("Playback check.");
    await page.getByRole("button", { name: /generate voice/i }).click();

    const audio = page.locator("audio");
    await expect(audio).toHaveAttribute("src", /^blob:/, { timeout: 60_000 });

    const state = await audio.evaluate((el: HTMLAudioElement) => ({
      readyState: el.readyState,
      duration: el.duration,
      errorCode: el.error?.code ?? null,
    }));

    expect(state.errorCode, "the element must not have rejected its source").toBeNull();
    // HAVE_CURRENT_DATA or better means it genuinely decoded.
    expect(state.readyState).toBeGreaterThanOrEqual(2);
    expect(state.duration).toBeGreaterThan(0);
  });
});

/**
 * The clip's silhouette under the player.
 *
 * Two failures to guard, and both looked like styling problems rather than
 * bugs.
 *
 * It used to plot a live 64-point FFT. Speech puts nearly all its energy in the
 * first few of those 32 bins, so most bars sat pinned at their minimum height
 * forever and it read as a broken chart. Drawing the clip's amplitude envelope
 * instead means every bar carries signal — which is only true if the heights
 * actually vary.
 *
 * And the class name `waveform-bar` is also defined in landing.css, for the
 * marketing page's decorative pulse. Both stylesheets are global, so the
 * landing rule painted every bar the same orange and animated them, erasing the
 * played/unplayed distinction entirely. Hence the deliberately distinct
 * `clip-wave-*` names, and hence checking the colours differ rather than
 * trusting the class list.
 */
test.describe("clip silhouette", () => {
  test("every bar carries signal, rather than most sitting at the floor", async ({ page }) => {
    await page.goto("/tts");
    await page.locator("textarea").first().fill("A sentence with a pause, and then some more words after it.");
    await page.getByRole("button", { name: /generate voice/i }).click();

    const bars = page.locator(".clip-wave-bar");
    await expect(bars.first()).toBeVisible({ timeout: 60_000 });

    const heights = await bars.evaluateAll((els) =>
      els.map((el) => parseFloat((el as HTMLElement).style.height) || 0)
    );

    expect(heights.length).toBeGreaterThan(16);
    // The old version produced two or three distinct values across 32 bars.
    expect(new Set(heights.map((h) => Math.round(h))).size).toBeGreaterThan(10);
    expect(Math.max(...heights)).toBeGreaterThan(50);
    // A flat chart would put nearly everything at the minimum.
    const atFloor = heights.filter((h) => h < 10).length;
    expect(atFloor).toBeLessThan(heights.length * 0.6);
  });

  test("every bar is the same width, so none reads as thicker than its neighbours", async ({ page }) => {
    await page.goto("/tts");
    await page.locator("textarea").first().fill("A line long enough to fill the whole strip of bars.");
    await page.getByRole("button", { name: /generate voice/i }).click();

    const bars = page.locator(".clip-wave-bar");
    await expect(bars.first()).toBeVisible({ timeout: 60_000 });

    // The invariant is checked on computed style, not rendered geometry. The
    // bug only shows on a fractional device pixel ratio, and the test runs at
    // DPR 1 where a fractional CSS width still snaps to a whole device pixel —
    // so measuring the rendered width here would pass even on the broken flex
    // version. What actually prevents the thick-and-thin look is that the bar
    // is not flex-grown and its width is a whole number of CSS pixels; that is
    // what holds at any DPR, and that is what this asserts.
    const style = await bars.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { flexGrow: cs.flexGrow, width: cs.width };
    });

    expect(style.flexGrow).toBe("0");
    const px = parseFloat(style.width);
    expect(Number.isInteger(px)).toBe(true);
  });

  test("played and unplayed are told apart, despite the landing page's identical class name", async ({ page }) => {
    await page.goto("/tts");
    await page.locator("textarea").first().fill("Another line to generate and then scrub through.");
    await page.getByRole("button", { name: /generate voice/i }).click();
    await expect(page.locator(".clip-wave-bar").first()).toBeVisible({ timeout: 60_000 });

    // Actually play for a moment: progress is read from the element while
    // playing, so nudging currentTime on a paused player changes nothing and
    // would leave every bar in the same state.
    await page.locator("button.play-btn").click();
    await page.waitForTimeout(1200);

    const colours = await page.locator(".clip-wave-bar").evaluateAll((els) => {
      const first = getComputedStyle(els[2]).backgroundColor;
      const last = getComputedStyle(els[els.length - 3]).backgroundColor;
      return { first, last, animation: getComputedStyle(els[0]).animationName };
    });

    expect(colours.first).not.toBe(colours.last);
    // The landing rule animates its bars; ours must not inherit that.
    expect(colours.animation).toBe("none");
  });
});
