# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow and Session Persistence >> should successfully sign out from dashboard and clear session
- Location: tests\auth.spec.ts:47:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.navbar button').filter({ hasText: 'Sign Out' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.navbar button').filter({ hasText: 'Sign Out' })

```

```yaml
- complementary:
  - link "🎙️ TransTTS AI":
    - /url: /
  - navigation:
    - button "📊 Dashboard"
    - button "🎙️ Voice Recorder"
    - button "🎤 Transcribe"
    - button "🌐 Translate"
    - button "🔊 Voice Generator"
    - button "💳 Pricing"
  - text: 👤 testuser testuser@example.com
  - button "🚪 Sign Out"
- heading "📊 Personal Dashboard" [level=1]
- paragraph: Monitor your speech tasks, usage limits, and account history
- text: "👤 testuser ✔️ Verified testuser@example.com Account Plan: Free Tier"
- heading "📊 Monthly Usage Limits" [level=3]
- text: Transcription Time 5 / 60 mins Translations (Jobs) 2 / 50 jobs Voice Generations 3 / 100 clips
- heading "🚀 Quick Launch Tools" [level=3]
- text: 🎤 Transcribe Audio/Video to text 🌐 Translate Multi-lang translation 🔊 Voice Gen Text to natural speech 11 Total Jobs 6 Transcriptions 2 Translations 3 Voice Generated
- button "📋 All"
- button "🎤 Transcription"
- button "🌐 Translation"
- button "🔊 Voice Generation"
- button "🗑️ Clear All History"
- text: 🔊 नमस्कार, यह एक परीक्षण है। Voice Generation 51m ago 🎧 hi-IN-MadhurNeural ✅ completed
- button "📋"
- button "▶"
- button "🗑️"
- text: 🎤 recorded-voice-1780406164270.webm Transcription 20h ago 🌐 English ⏱️ 34s ✅ completed
- button "📋"
- button "🗑️"
- text: 🔊 सोचिए एक पल के लिए, आप जो सबसे पुरानी महानिमारज जानते हैं, वो क्या है? मिसर के Voice Generation 1d ago 🎧 hi-IN-MadhurNeural ✅ completed
- button "📋"
- button "▶"
- button "🗑️"
- text: 🎤 Generated Audio May 26, 2026 - 8_19PM.wav Transcription 1d ago 🌐 Hindi ⏱️ 120s ✅ completed
- button "📋"
- button "🗑️"
- text: 🔊 जब आप अपनी नाक तोड़ते हैं, तो नाक की हड्डियां जगह से बाहर चली जाती हैं, जिससे सा Voice Generation 18d ago 🎧 hi-IN-SwaraNeural ✅ completed
- button "📋"
- button "▶"
- button "🗑️"
- text: 🌐 When you break your nose, the nasal bones shift out of place, making it hard to Translation 18d ago → HI ✅ completed
- button "📋"
- button "🗑️"
- text: 🎤 video_0fbc6475f8ca.mp4 Transcription 18d ago 🌐 English ⏱️ 23s ✅ completed
- button "📋"
- button "🗑️"
- text: 🎤 video_c98eeeabdd6c.mp4 Transcription 18d ago 🌐 English ⏱️ 17s ✅ completed
- button "📋"
- button "🗑️"
- text: 🌐 If you shoot a .50 caliber round at 10 skulls lined up in a row, how many peopl Translation 18d ago → HI ✅ completed
- button "📋"
- button "🗑️"
- text: 🎤 video_9b0db6fe0b29.mp4 Transcription 18d ago 🌐 English ⏱️ 19s ✅ completed
- button "📋"
- button "🗑️"
- text: 🎤 video_60801e53432e.mp4 Transcription 18d ago 🌐 English ⏱️ 61s ✅ completed
- button "📋"
- button "🗑️"
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Authentication Flow and Session Persistence", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Clear localStorage before each test
  6  |     await page.goto("/");
  7  |     await page.evaluate(() => localStorage.clear());
  8  |   });
  9  | 
  10 |   test("should load home page and navigate to login page", async ({ page }) => {
  11 |     await page.goto("/");
  12 |     await expect(page).toHaveTitle(/TransTTS/);
  13 |     
  14 |     // Find Sign In link in Navbar and click it
  15 |     const signInBtn = page.locator(".navbar .btn-ghost").filter({ hasText: "Sign In" });
  16 |     await expect(signInBtn).toBeVisible();
  17 |     await signInBtn.click();
  18 |     
  19 |     await expect(page).toHaveURL(/\/login/);
  20 |   });
  21 | 
  22 |   test("should successfully log in with credentials and redirect to dashboard", async ({ page }) => {
  23 |     await page.goto("/login");
  24 | 
  25 |     // Enter email and password
  26 |     await page.fill('input[type="email"]', "testuser@example.com");
  27 |     await page.fill('input[type="password"]', "password123");
  28 | 
  29 |     // Click Sign In button
  30 |     const submitBtn = page.locator('button[type="submit"]', { hasText: "Sign In" });
  31 |     await expect(submitBtn).toBeVisible();
  32 |     await submitBtn.click();
  33 | 
  34 |     // Verify loading state or spinner if any, then wait for redirect
  35 |     await page.waitForURL(/\/dashboard/, { timeout: 5000 });
  36 | 
  37 |     // Check dashboard header and stored credentials
  38 |     await expect(page.locator("h1")).toContainText(/Dashboard/i);
  39 |     
  40 |     const isLoggedIn = await page.evaluate(() => localStorage.getItem("isLoggedIn"));
  41 |     const userEmail = await page.evaluate(() => localStorage.getItem("userEmail"));
  42 |     
  43 |     expect(isLoggedIn).toBe("true");
  44 |     expect(userEmail).toBe("testuser@example.com");
  45 |   });
  46 | 
  47 |   test("should successfully sign out from dashboard and clear session", async ({ page }) => {
  48 |     // Directly inject logged-in state to localStorage to skip login step
  49 |     await page.goto("/");
  50 |     await page.evaluate(() => {
  51 |       localStorage.setItem("isLoggedIn", "true");
  52 |       localStorage.setItem("userEmail", "testuser@example.com");
  53 |       localStorage.setItem("userName", "testuser");
  54 |     });
  55 | 
  56 |     // Go to dashboard
  57 |     await page.goto("/dashboard");
  58 |     await expect(page.locator("h1")).toContainText(/Dashboard/i);
  59 | 
  60 |     // Click sign out button in Navbar
  61 |     const signOutBtn = page.locator(".navbar button", { hasText: "Sign Out" });
> 62 |     await expect(signOutBtn).toBeVisible();
     |                              ^ Error: expect(locator).toBeVisible() failed
  63 |     await signOutBtn.click();
  64 | 
  65 |     // Verify redirected back to home page
  66 |     await page.waitForURL("http://localhost:3000/");
  67 | 
  68 |     // Verify credentials cleared
  69 |     const isLoggedIn = await page.evaluate(() => localStorage.getItem("isLoggedIn"));
  70 |     expect(isLoggedIn).toBeNull();
  71 |   });
  72 | });
  73 | 
```