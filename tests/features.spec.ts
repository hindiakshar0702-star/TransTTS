import { test, expect } from "@playwright/test";

test.describe("Core Features Functional Validation", () => {
  
  test.beforeEach(async ({ page }) => {
    // Inject active login session into localStorage to bypass auth guard for page routes
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", "featuretest@example.com");
      localStorage.setItem("userName", "featuretest");
    });
  });

  test("should interact with TTS Generator Board and show generating state", async ({ page }) => {
    await page.goto("/tts");
    await expect(page.locator("h1")).toContainText(/Voice Generator Board/i);

    // Verify script textarea is present and input script text
    const textInput = page.locator("textarea.textarea-input");
    await expect(textInput).toBeVisible();
    await textInput.fill("नमस्कार, यह एक परीक्षण है।");

    // Adjust speed range slider
    const speedSlider = page.locator("input.speed-slider");
    await expect(speedSlider).toBeVisible();
    await speedSlider.fill("1.2");
    await expect(page.locator(".speed-value")).toContainText("1.2x");

    // Click on a voice card (e.g. Swara or Madhur)
    const voiceCard = page.locator(".voice-card").filter({ hasText: "Madhur" });
    await expect(voiceCard).toBeVisible();
    await voiceCard.click();
    await expect(voiceCard).toHaveClass(/selected/);

    // Click Generate Voice
    const generateBtn = page.locator("button.btn-primary", { hasText: "Generate Voice" });
    await expect(generateBtn).toBeVisible();
    
    // Intercept API call or check that loading state starts
    await generateBtn.click();
    await expect(page.locator("button.btn-primary")).toContainText(/Generating/i);
  });

  test("should interact with AI Translation Board and show translating state", async ({ page }) => {
    await page.goto("/translate");
    await expect(page.locator("h1")).toContainText(/Translation Board/i);

    // Select source language (auto detect) and target language (Hindi - hi)
    const sourceSelect = page.locator("select.select-input").first();
    const targetSelect = page.locator("select.select-input").last();
    
    await expect(sourceSelect).toBeVisible();
    await expect(targetSelect).toBeVisible();

    await sourceSelect.selectOption("auto");
    await targetSelect.selectOption("hi");

    // Input text in source box
    const sourceTextArea = page.locator("textarea.textarea-input").first();
    await sourceTextArea.fill("Hello world, this is a web E2E test.");

    // Click Translate button
    const translateBtn = page.locator("button.btn-primary", { hasText: "Translate Now" });
    await expect(translateBtn).toBeVisible();
    await translateBtn.click();

    // Verify loading spinner is displayed on translate button
    await expect(page.locator("button.btn-primary")).toContainText(/Translating/i);
  });

  test("should fill out and successfully submit the Contact Sales form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("h1")).toContainText(/Contact Sales/i);

    // Fill the required form fields
    await page.fill('input[placeholder="Your full name"]', "Test User");
    await page.fill('input[placeholder="you@company.com"]', "testuser@company.com");
    await page.fill('input[placeholder="Your company name"]', "Acme Corp");
    await page.selectOption("select.select-input", "6-20");
    await page.fill('textarea.textarea-input', "We want to purchase a bulk enterprise package for Voice synthesis.");

    // Submit form
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify success banner and toast matches
    await expect(page.locator("h2")).toContainText(/Thank You/i);
    await expect(page.locator(".container")).toContainText("testuser@company.com");
  });

  test("should load the Voice Recorder & Teleprompter interface", async ({ page }) => {
    await page.goto("/record");
    await expect(page.locator("h1")).toContainText(/Voice Recorder/i);

    // Verify teleprompter area is loaded
    const teleprompter = page.locator(".glass-card").filter({ hasText: /Teleprompter Script/i });
    await expect(teleprompter).toBeVisible();

    // Check Start Recording toggle button
    const startRecordBtn = page.locator("button.btn-primary", { hasText: /Start Recording/i });
    await expect(startRecordBtn).toBeVisible();
  });
});
