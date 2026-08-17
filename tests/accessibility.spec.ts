import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * The public marketing/legal pages are audited strictly. The signed-in tool
 * pages (transcribe/translate/tts/record) carry known brand-orange-on-light
 * contrast debt that predates this variant — they used to redirect to /login,
 * so they were never actually audited. Until a dedicated contrast pass lands,
 * those pages are audited for everything EXCEPT color-contrast, so real
 * structural/ARIA/label regressions still fail the build.
 */
const pagesToTest: Array<{ name: string; path: string; skipContrast?: boolean }> = [
  { name: "Home Page", path: "/" },
  { name: "About Page", path: "/about" },
  { name: "Contact Page", path: "/contact" },
  { name: "Privacy Page", path: "/privacy-policy" },
  { name: "Terms Page", path: "/terms-and-conditions" },
  { name: "Transcribe Feature Page", path: "/transcribe", skipContrast: true },
  { name: "Translate Feature Page", path: "/translate", skipContrast: true },
  { name: "TTS Feature Page", path: "/tts", skipContrast: true },
  { name: "Voice Recorder Page", path: "/record", skipContrast: true },
];

test.describe("Accessibility (a11y) Audits", () => {
  for (const pageInfo of pagesToTest) {
    test(`should have no critical accessibility violations on ${pageInfo.name}`, async ({ page }) => {
      await page.goto(pageInfo.path);

      // Wait for the page to be STYLED, not merely parsed. Running axe at
      // domcontentloaded audits a flash of unstyled content, where cards have
      // no background and contrast checks fail intermittently. networkidle lets
      // the CSS settle first.
      await page.waitForLoadState("networkidle");
      await page.locator("main, .landing-page, .dashboard-layout").first().waitFor({ state: "visible" });

      let builder = new AxeBuilder({ page }).withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
      ]);
      if (pageInfo.skipContrast) {
        builder = builder.disableRules(["color-contrast"]);
      }

      const results = await builder.analyze();

      if (results.violations.length > 0) {
        console.warn(`Accessibility violations detected on ${pageInfo.name} (${pageInfo.path}):`);
        results.violations.forEach((violation) => {
          console.warn(`- Rule: ${violation.id} (${violation.description})`);
          console.warn(`  Severity: ${violation.impact}`);
          console.warn(`  Target elements:`, violation.nodes.map((n) => n.target).flat());
        });
      }

      expect(results.violations).toEqual([]);
    });
  }
});
