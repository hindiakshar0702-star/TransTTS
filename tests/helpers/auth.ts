import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Test auth helpers for the Auth.js v5 flow.
 *
 * Since the migration, POST /api/auth/register only CREATES the account — it no
 * longer sets a session. A session is established by Auth.js credentials
 * sign-in. These helpers register a throwaway user and then complete that
 * sign-in against the shared cookie jar (APIRequestContext or the page's
 * request context), so protected pages/routes see an authenticated session.
 */

const rnd = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// Unique client IP per call so the per-IP rate-limit guards (auth-register etc.)
// bucket each test independently — the whole suite otherwise shares 127.0.0.1
// and trips the 10/min register cap. Mirrors the otp spec's nextIp() approach.
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `172.${(ipCounter >> 8) & 255}.${ipCounter & 255}.11`;
}

/** Complete an Auth.js Credentials sign-in on the given request context. */
export async function signInApi(
  request: APIRequestContext,
  email: string,
  password: string,
  extraHeaders: Record<string, string> = {}
): Promise<void> {
  // Only forward non-content-type extras (e.g. x-forwarded-for for rate-limit
  // bucketing); this helper owns the content-type for each request.
  const { "content-type": _ct, "Content-Type": _Ct, ...safeExtra } = extraHeaders;
  void _ct; void _Ct;

  const csrfRes = await request.get("/api/auth/csrf", { headers: safeExtra });
  const { csrfToken } = await csrfRes.json();

  const res = await request.post("/api/auth/callback/credentials", {
    headers: { ...safeExtra, "content-type": "application/x-www-form-urlencoded" },
    form: { csrfToken, email, password, json: "true" },
    // Auth.js responds with a redirect on success; we only need the Set-Cookie.
    maxRedirects: 0,
  });
  // 200 or 3xx both indicate the session cookie was issued.
  expect(res.status(), "credentials sign-in should succeed").toBeLessThan(400);
}

/** Register a fresh user AND sign them in. Returns the credentials. */
export async function registerAndSignIn(
  request: APIRequestContext,
  opts: { emailPrefix?: string; headers?: Record<string, string> } = {}
): Promise<{ email: string; password: string }> {
  const email = `${opts.emailPrefix ?? "pw"}-${rnd()}@transtts.local`;
  const password = "TestPass123";
  // Default to a unique IP unless the caller pinned one, so the register/sign-in
  // rate-limit buckets don't collide across the suite (shared localhost IP).
  const extra = opts.headers ?? { "x-forwarded-for": uniqueIp() };
  const reg = await request.post("/api/auth/register", {
    headers: { "content-type": "application/json", ...extra },
    data: { email, password, name: "PW Tester" },
  });
  expect(reg.status(), "register should create account").toBe(201);
  await signInApi(request, email, password, extra);
  return { email, password };
}

/** Page-context variant: registers + signs in using the page's request jar. */
export async function loginPage(page: Page, opts: { emailPrefix?: string } = {}) {
  return registerAndSignIn(page.request, opts);
}
