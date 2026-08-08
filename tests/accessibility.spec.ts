import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pagesToTest = [
  { name: "Home Page", path: "/" },
  { name: "Login Page", path: "/login" },
  { name: "Contact Page", path: "/contact" },
  { name: "Transcribe Feature Page", path: "/transcribe" },
  { name: "Translate Feature Page", path: "/translate" },
  { name: "TTS Feature Page", path: "/tts" },
  { name: "Voice Recorder Page", path: "/record" },
];

test.describe("Accessibility (a11y) Audits", () => {
  for (const pageInfo of pagesToTest) {
    test(`should have no critical accessibility violations on ${pageInfo.name}`, async ({ page }) => {
      // For pages requiring mock auth (like record, transcribe etc. if needed),
      // we can visit directly since they don't block access, or we can login first.
      // Let's set isLoggedIn to true in localStorage to mock logged-in state just in case
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userEmail", "a11ytest@example.com");
      });

      await page.goto(pageInfo.path);

      // Wait for the page to be STYLED, not merely parsed. Running axe at
      // domcontentloaded audited a flash of unstyled content — before the
      // stylesheet applied, cards had no background and text sat over the dark
      // body, so contrast checks failed intermittently on whichever page had
      // the most secondary text. networkidle lets the CSS settle first.
      await page.waitForLoadState("networkidle");
      await page.locator("main, .landing-page").first().waitFor({ state: "visible" });

      // Run accessibility audit
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      // Log violations to console for easier debugging
      if (results.violations.length > 0) {
        console.warn(`Accessibility violations detected on ${pageInfo.name} (${pageInfo.path}):`);
        results.violations.forEach((violation) => {
          console.warn(`- Rule: ${violation.id} (${violation.description})`);
          console.warn(`  Severity: ${violation.impact}`);
          console.warn(`  Target elements:`, violation.nodes.map(n => n.target).flat());
        });
      }

      // Assert that there are no critical accessibility violations
      // In many web apps, minor color contrast issues or external library SVGs can cause warnings,
      // but let's assert empty to ensure high quality (and if there are failures, we can fix them).
      expect(results.violations).toEqual([]);
    });
  }
});
