import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Test auth helpers.
 *
 * Google is the only sign-in method in the app, and its consent screen cannot
 * be driven from Playwright. The suite therefore uses the `test-login`
 * provider, which signs in an email without verification and exists only when
 * AUTH_TEST_MODE=1 outside production (see src/auth.ts). Accounts are created
 * on first use, so there is no registration step.
 */

const rnd = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// Unique client IP per call so the per-IP rate-limit guards bucket each test
// independently — the whole suite otherwise shares 127.0.0.1 and trips the
// caps. Mirrors the otp spec's nextIp() approach.
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `172.${(ipCounter >> 8) & 255}.${ipCounter & 255}.11`;
}

/** Sign in as `email` through the test-login provider, creating it if needed. */
export async function signInApi(
  request: APIRequestContext,
  email: string,
  extraHeaders: Record<string, string> = {}
): Promise<void> {
  // Only forward non-content-type extras (e.g. x-forwarded-for for rate-limit
  // bucketing); this helper owns the content-type for each request.
  const { "content-type": _ct, "Content-Type": _Ct, ...safeExtra } = extraHeaders;
  void _ct; void _Ct;

  const csrfRes = await request.get("/api/auth/csrf", { headers: safeExtra });
  const { csrfToken } = await csrfRes.json();

  const res = await request.post("/api/auth/callback/test-login", {
    headers: { ...safeExtra, "content-type": "application/x-www-form-urlencoded" },
    form: { csrfToken, email, json: "true" },
    // Auth.js responds with a redirect on success; we only need the Set-Cookie.
    maxRedirects: 0,
  });
  expect(
    res.status(),
    "test-login should succeed — is AUTH_TEST_MODE=1 set for the dev server?"
  ).toBeLessThan(400);
}

/** Create a throwaway account and sign in as it. */
export async function registerAndSignIn(
  request: APIRequestContext,
  opts: { emailPrefix?: string; headers?: Record<string, string> } = {}
): Promise<{ email: string }> {
  const email = `${opts.emailPrefix ?? "pw"}-${rnd()}@transtts.local`;
  const extra = opts.headers ?? { "x-forwarded-for": uniqueIp() };
  await signInApi(request, email, extra);
  return { email };
}

/** Page-context variant: signs in using the page's request jar. */
export async function loginPage(page: Page, opts: { emailPrefix?: string } = {}) {
  return registerAndSignIn(page.request, opts);
}
