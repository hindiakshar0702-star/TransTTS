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

const PAGES = ["/", "/transcribe", "/settings"];

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
