import { test, expect } from "@playwright/test";

// The app is public — the tool pages need no sign-in.
test.describe("Core Features Functional Validation", () => {

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
    // Speed readout is an inline pill showing "{speed}x"
    await expect(page.getByText("1.2x", { exact: true })).toBeVisible();

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
    await expect(page.locator("h1")).toContainText(/Translation Studio/i);

    // Language pickers are custom dropdowns (LanguageSelect), not native selects.
    const langTriggers = page.locator(".custom-lang-trigger");
    await expect(langTriggers.first()).toBeVisible();

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

  test("should fill out and successfully submit the Contact Us form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("h1")).toContainText(/talk/i);

    // Fill the required form fields (zod: name 2+, valid email, message 10+)
    await page.fill("#c-name", "Test User");
    await page.fill("#c-email", "testuser@example.com");
    await page.fill("#c-message", "This is an automated Playwright end-to-end test message.");

    // Submit form — POSTs /api/contact (mail transport dev-logs when unconfigured)
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify success state
    await expect(page.locator("h2", { hasText: /Message sent/i })).toBeVisible({ timeout: 10000 });
  });

  test("should load the Voice Recorder & Teleprompter interface", async ({ page }) => {
    await page.goto("/record");
    await expect(page.locator("h1")).toContainText(/Voice Recorder/i);

    // Verify teleprompter area is loaded
    const teleprompter = page.locator(".glass-card").filter({ hasText: /Script Teleprompter/i });
    await expect(teleprompter).toBeVisible();

    // Check Start Recording toggle button (round icon button, aria-labelled)
    const startRecordBtn = page.getByRole("button", { name: /Start Recording/i });
    await expect(startRecordBtn).toBeVisible();
  });
});
