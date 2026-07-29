import { test, expect } from "@playwright/test";

test.describe("Authentication Flow and Session Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("should load home page and navigate to login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TransTTS/);
    
    // Find Sign In link in Navbar and click it
    const signInBtn = page.locator(".navbar .btn-ghost").filter({ hasText: "Sign In" });
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();
    
    await expect(page).toHaveURL(/\/login/);
  });

  test("should successfully log in with credentials and redirect to dashboard", async ({ page }) => {
    await page.goto("/login");

    // Enter email and password
    await page.fill('input[type="email"]', "testuser@example.com");
    await page.fill('input[type="password"]', "password123");

    // Click Sign In button
    const submitBtn = page.locator('button[type="submit"]', { hasText: "Sign In" });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify loading state or spinner if any, then wait for redirect
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });

    // Check dashboard header and stored credentials
    await expect(page.locator("h1")).toContainText(/Dashboard/i);
    
    const isLoggedIn = await page.evaluate(() => localStorage.getItem("isLoggedIn"));
    const userEmail = await page.evaluate(() => localStorage.getItem("userEmail"));
    
    expect(isLoggedIn).toBe("true");
    expect(userEmail).toBe("testuser@example.com");
  });

  test("should successfully sign out from dashboard and clear session", async ({ page }) => {
    // Directly inject logged-in state to localStorage to skip login step
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", "testuser@example.com");
      localStorage.setItem("userName", "testuser");
    });

    // Go to dashboard
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText(/Dashboard/i);

    // Click sign out button in Navbar
    const signOutBtn = page.locator(".navbar button", { hasText: "Sign Out" });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Verify redirected back to home page
    await page.waitForURL("http://localhost:3000/");

    // Verify credentials cleared
    const isLoggedIn = await page.evaluate(() => localStorage.getItem("isLoggedIn"));
    expect(isLoggedIn).toBeNull();
  });
});
