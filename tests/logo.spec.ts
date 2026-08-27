import { test, expect, type Page } from "@playwright/test";

/**
 * The word "Trans" has now disappeared twice, and neither time did anything
 * fail.
 *
 * The logo takes a `variant` that hardcodes its text colour — "dark" paints it
 * white, "light" paints it near-black — so a logo dropped onto a surface the
 * author did not expect renders in the surface's own colour. Only "TTS"
 * survives, because that half is painted with the brand gradient, which is why
 * the result reads as a design choice rather than a bug.
 *
 * The accessibility suite cannot catch it: the tool pages run with
 * colour-contrast disabled, for unrelated brand-orange debt.
 *
 * So this checks the thing directly — every logo on the page, against the
 * surface actually behind it, in both themes.
 */

const PAGES = ["/", "/record", "/transcribe", "/settings"];

/** Rough perceptual brightness; enough to tell "invisible" from "legible". */
const MIN_BRIGHTNESS_GAP = 60;

async function logoContrast(page: Page) {
  return page.evaluate((minGap) => {
    const brightness = (rgb: string) => {
      const m = rgb.match(/\d+/g);
      if (!m) return null;
      return 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2];
    };

    /** The nearest ancestor that actually paints something. */
    const surface = (el: HTMLElement) => {
      for (let a: HTMLElement | null = el; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        // A gradient is a deliberate surface, and its endpoints are not worth
        // parsing — treat it as handled and stop.
        if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") return cs.backgroundColor;
      }
      return null;
    };

    const results: { where: string; text: string; bg: string; gap: number }[] = [];

    document.querySelectorAll<HTMLElement>(".transtts-logo-component").forEach((logo) => {
      const rect = logo.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const word = logo.querySelector("span");
      const bg = surface(logo);
      if (!word || !bg) return;

      const fg = getComputedStyle(word).color;
      const gap = Math.abs((brightness(fg) ?? 0) - (brightness(bg) ?? 0));
      if (gap < minGap) {
        results.push({
          where: (logo.closest("[class]")?.className || "?").toString().slice(0, 40),
          text: fg,
          bg,
          gap: Math.round(gap),
        });
      }
    });

    return results;
  }, MIN_BRIGHTNESS_GAP);
}

for (const theme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`logo stays legible: ${path} @ mobile, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: "networkidle" });

      // The app switches theme through <html data-theme>, from its settings
      // page, rather than following the OS preference.
      await page.evaluate((t) => {
        if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
        else document.documentElement.removeAttribute("data-theme");
      }, theme);
      await page.waitForTimeout(300);

      const invisible = await logoContrast(page);
      const report = invisible.map((i) => `${i.where}: ${i.text} on ${i.bg} (gap ${i.gap})`).join("; ");
      expect(invisible, `logo text too close to its background — ${report}`).toEqual([]);
    });
  }
}
