import { test, expect } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

/**
 * Authentication flow — Auth.js v5 cookie session, Google-only sign-in.
 *
 * There is no email/password form and no registration page any more, so the
 * sign-in screen is asserted rather than driven: Google's consent screen cannot
 * be automated. Session behaviour is exercised through the test-login provider
 * (see helpers/auth.ts).
 */

test.describe("Authentication Flow and Session Persistence", () => {
  test("/login offers Google sign-in and no password form", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TransTTS/);

    // Login/Signup links are intentionally absent from the header — go direct.
    await page.goto("/login");
    await expect(page.locator(".landing-nav")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();

    // The email/password sign-in and registration flow was removed with the
    // move to Google-only auth; nothing should ask for credentials here.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test("the removed credential endpoints no longer function", async ({ request }) => {
    // The explicit routes are deleted; Auth.js's catch-all now owns these
    // paths, so they answer 4xx instead of doing anything. The point is that
    // none of them succeed — there is no way to register or set a password.
    for (const path of [
      "/api/auth/register",
      "/api/auth/change-password",
      "/api/auth/request-reset",
      "/api/auth/reset-password",
    ]) {
      const res = await request.post(path, { data: {} });
      expect(res.status(), `${path} must not succeed`).toBeGreaterThanOrEqual(400);
    }
  });

  test("an authenticated session reaches the dashboard", async ({ page }) => {
    await registerAndSignIn(page.request, { emailPrefix: "pw-auth-in" });

    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText(/Dashboard|Welcome/i);

    // Session is a real cookie — the /api/auth/me probe must succeed.
    const me = await page.request.get("/api/auth/me");
    expect(me.ok()).toBeTruthy();
  });

  test("signs out from the dashboard and the session is invalidated", async ({ page }) => {
    await registerAndSignIn(page.request, { emailPrefix: "pw-auth-out" });

    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText(/Dashboard|Welcome/i);

    await page.locator(".sidebar-logout-btn").click();
    await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"), { timeout: 10000 });

    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });
});
