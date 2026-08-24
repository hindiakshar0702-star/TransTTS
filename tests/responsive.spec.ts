import { test, expect, type Page } from "@playwright/test";

/**
 * Responsive / multi-device tests across mobile, tablet, and desktop viewports.
 * Asserts no page-level horizontal overflow, and that the breakpoint-specific
 * nav chrome (landing hamburger, dashboard drawer + bottom tab bar) shows/hides
 * at the right widths. The app is public, so no sign-in is needed.
 */

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

const PAGES = ["/", "/dashboard", "/record", "/transcribe", "/translate", "/tts", "/settings"];

async function hasHorizontalOverflow(page: Page): Promise<{ scrollW: number; clientW: number }> {
  return page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
}

// No page should scroll horizontally at any breakpoint.
for (const [name, size] of Object.entries(VIEWPORTS)) {
  for (const path of PAGES) {
    test(`no horizontal overflow: ${path} @ ${name} (${size.width}px)`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(path, { waitUntil: "networkidle" });
      const { scrollW, clientW } = await hasHorizontalOverflow(page);
      expect(scrollW, `${path} @ ${name} must not overflow horizontally`).toBeLessThanOrEqual(clientW + 2);
    });
  }
}


/**
 * Content clipped off the right edge, which the scrollWidth check above cannot
 * see.
 *
 * A page whose layout is too wide does not necessarily scroll: an ancestor with
 * `overflow-x: hidden` absorbs it and simply cuts the excess off, so the
 * document reports exactly the viewport width while the user sees a button
 * sliced in half. That is how /record shipped with all three of its cards 23px
 * past the screen edge and this suite still passing.
 *
 * The usual cause is an item that will not shrink: a grid or flex item's
 * minimum size is its content, not zero, so one unwrappable row widens the
 * whole track and drags its siblings out with it.
 */
async function clippedElements(page: Page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders: { desc: string; width: number; over: number }[] = [];

    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const style = getComputedStyle(el);
      // Fixed chrome and hidden elements are positioned deliberately.
      if (style.position === "fixed" || style.visibility === "hidden") return;

      // A carousel is meant to extend past the edge; its own scroller clips it.
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ax = getComputedStyle(a).overflowX;
        if (ax === "auto" || ax === "scroll") return;
      }

      // Only things a reader loses when they are cut off. Decorative shapes are
      // routinely bled past a card's edge on purpose and clipped by it, and
      // failing on those would train everyone to ignore this test.
      const carriesText = (el.textContent || "").trim().length > 0;
      const isControl = ["button", "a", "input", "select", "textarea", "img", "svg"].includes(
        el.tagName.toLowerCase()
      );
      if (!carriesText && !isControl) return;

      const over = rect.right - viewport;
      if (over > 1) {
        offenders.push({
          desc: `<${el.tagName.toLowerCase()} class="${el.className}">`.slice(0, 90),
          width: Math.round(rect.width),
          over: Math.round(over),
        });
      }
    });

    return offenders.sort((a, b) => b.over - a.over).slice(0, 5);
  });
}

for (const path of PAGES) {
  test(`nothing clipped off the right edge: ${path} @ mobile`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(path, { waitUntil: "networkidle" });
    const offenders = await clippedElements(page);
    const report = offenders
      .map((o) => `  ${o.over}px over — ${o.width}px wide — ${o.desc}`)
      .join("; ");
    expect(offenders, `${path} has content past the right edge: ${report}`).toEqual([]);
  });
}

test("landing header: hamburger on mobile, full nav on desktop", async ({ page }) => {
  // Mobile → hamburger visible, desktop nav-items pill hidden.
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".nav-hamburger-btn").first()).toBeVisible();
  await expect(page.locator(".landing-nav-links").first()).toBeHidden();

  // Desktop → nav-items pill visible, hamburger hidden.
  await page.setViewportSize(VIEWPORTS.desktop);
  await expect(page.locator(".landing-nav-links").first()).toBeVisible();
  await expect(page.locator(".nav-hamburger-btn").first()).toBeHidden();
});

test("landing mobile menu opens on hamburger tap", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".landing-nav-mobile-menu")).toHaveCount(0);
  await page.locator(".nav-hamburger-btn").first().click();
  await expect(page.locator(".landing-nav-mobile-menu")).toBeVisible();
});

test("dashboard chrome: drawer + bottom tab on mobile, sidebar on desktop", async ({ page }) => {
  // Mobile → top bar + bottom tab bar visible, sidebar off-canvas.
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.locator(".mobile-topbar")).toBeVisible();
  await expect(page.locator(".bottom-tab-bar")).toBeVisible();

  // Desktop → sidebar visible, bottom tab bar hidden.
  await page.setViewportSize(VIEWPORTS.desktop);
  await expect(page.locator(".dashboard-sidebar")).toBeVisible();
  await expect(page.locator(".bottom-tab-bar")).toBeHidden();
});

test("mobile drawer opens from the top-bar hamburger", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto("/settings", { waitUntil: "networkidle" });
  const sidebar = page.locator(".dashboard-sidebar");
  // Off-canvas: translated fully left (negative x in the transform matrix).
  const closedTransform = await sidebar.evaluate((el) => getComputedStyle(el).transform);
  expect(closedTransform).toContain("matrix");
  await page.locator(".mobile-hamburger").click();
  await expect(sidebar).toHaveClass(/open/);
});
