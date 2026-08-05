import { test, expect, type Page } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

/**
 * Authentication flow — Auth.js v5 cookie session. Login/Sign-up links are
 * intentionally absent from the public chrome, so tests navigate to /login
 * directly. Register only creates the account (no auto-session); the UI login
 * test exercises signIn("credentials") through the form.
 */

function uniqueEmail(): string {
  return `pw-auth-${Date.now()}-${Math.floor(Math.random() * 1e6)}@transtts.local`;
}

async function registerOnly(page: Page, email: string): Promise<void> {
  const res = await page.request.post("/api/auth/register", {
    data: { email, password: "TestPass123", name: "PW Auth Tester" },
  });
  expect(res.status()).toBe(201);
}

test.describe("Authentication Flow and Session Persistence", () => {
  test("home page loads and /login shows the sign-in form with the landing header", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TransTTS/);

    // Login/Signup links are intentionally removed from the header — go direct.
    await page.goto("/login");
    await expect(page.locator(".landing-nav")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(/Sign In/i);
  });

  test("logs in with credentials and lands on the dashboard", async ({ page }) => {
    const email = uniqueEmail();
    await registerOnly(page, email);

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "TestPass123");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator("h1")).toContainText(/Dashboard|Welcome/i);

    // Session is a real cookie — the /api/auth/me probe must succeed.
    const me = await page.request.get("/api/auth/me");
    expect(me.ok()).toBeTruthy();
  });

  test("signs out from the dashboard and the session is invalidated", async ({ page }) => {
    const email = uniqueEmail();
    // Register + Auth.js sign-in so we land authenticated.
    await registerAndSignIn(page.request, { emailPrefix: "pw-auth-out" });

    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText(/Dashboard|Welcome/i);

    await page.locator(".sidebar-logout-btn").click();
    await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"), { timeout: 10000 });

    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });
});
