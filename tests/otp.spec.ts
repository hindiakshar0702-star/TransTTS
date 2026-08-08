import { test, expect, type APIRequestContext } from "@playwright/test";
import { signInApi } from "./helpers/auth";

/**
 * OTP (email + mobile) end-to-end API tests. Deterministic and provider-free:
 *   - OTP_TEST_MODE=1 lets us read the code via /api/auth/otp/test-peek (no real
 *     email/SMS is ever sent — the mail/sms transports log-only when unconfigured,
 *     which is the case in CI/dev).
 *   - Each test uses a UNIQUE x-forwarded-for so the in-memory IP rate limiter
 *     buckets per test (no cross-test interference); the rate-limit test reuses
 *     one IP on purpose.
 *   - Expiry is exercised via the test-only `x-otp-test-ttl` header (gated on
 *     OTP_TEST_MODE) so we hit the real expiry branch without waiting 10 minutes.
 */

let ipCounter = 0;
const nextIp = () => `10.${(++ipCounter >> 8) & 255}.${ipCounter & 255}.7`;
const rnd = () => Math.random().toString(36).slice(2, 10);

function headers(ip: string, extra: Record<string, string> = {}) {
  return { "x-forwarded-for": ip, "content-type": "application/json", ...extra };
}

async function registerUser(request: APIRequestContext, ip: string) {
  const email = `otp_${Date.now()}_${rnd()}@test.dev`;
  // The account is created on first sign-in — the OTP routes read
  // getSessionUser(), so they need a real session behind the request.
  await signInApi(request, email, headers(ip));
  return { email };
}

async function peek(request: APIRequestContext, ip: string, type: "EMAIL" | "MOBILE", target: string) {
  const res = await request.get(
    `/api/auth/otp/test-peek?type=${type}&target=${encodeURIComponent(target)}`,
    { headers: headers(ip) }
  );
  expect(res.ok(), "test-peek must be reachable (OTP_TEST_MODE=1)").toBeTruthy();
  return (await res.json()).code as string;
}

const wrongOf = (code: string) => `${(Number(code[0]) + 1) % 10}${code.slice(1)}`;
const uniquePhone = () => `+9198${String(Date.now()).slice(-6)}${String(ipCounter).padStart(2, "0")}`;

// ---------------------------------------------------------------- EMAIL -----

test.describe("Email OTP", () => {
  test("happy path: send → correct code → verified", async ({ request }) => {
    const ip = nextIp();
    const { email } = await registerUser(request, ip);

    const send = await request.post("/api/auth/otp/email/send", { headers: headers(ip) });
    expect(send.status()).toBe(200);

    const code = await peek(request, ip, "EMAIL", email);
    expect(code).toMatch(/^\d{6}$/);

    const verify = await request.post("/api/auth/otp/email/verify", {
      headers: headers(ip),
      data: { code },
    });
    expect(verify.status()).toBe(200);
    expect((await verify.json()).emailVerified).toBe(true);

    const me = await (await request.get("/api/auth/me", { headers: headers(ip) })).json();
    expect(me.user.emailVerified).toBe(true);
  });

  test("wrong code → 400 invalid with attempts remaining", async ({ request }) => {
    const ip = nextIp();
    const { email } = await registerUser(request, ip);
    await request.post("/api/auth/otp/email/send", { headers: headers(ip) });
    const code = await peek(request, ip, "EMAIL", email);

    const res = await request.post("/api/auth/otp/email/verify", {
      headers: headers(ip),
      data: { code: wrongOf(code) },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("invalid");
    expect(body.remaining).toBe(4);
  });

  test("expired code → 400 expired", async ({ request }) => {
    const ip = nextIp();
    const { email } = await registerUser(request, ip);
    // ttl=0 → code is already expired the moment it is stored.
    await request.post("/api/auth/otp/email/send", { headers: headers(ip, { "x-otp-test-ttl": "0" }) });
    const code = await peek(request, ip, "EMAIL", email);

    const res = await request.post("/api/auth/otp/email/verify", {
      headers: headers(ip),
      data: { code },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).reason).toBe("expired");
  });

  test("max attempts → lockout, then correct code rejected", async ({ request }) => {
    const ip = nextIp();
    const { email } = await registerUser(request, ip);
    await request.post("/api/auth/otp/email/send", { headers: headers(ip) });
    const code = await peek(request, ip, "EMAIL", email);
    const bad = wrongOf(code);

    let last;
    for (let i = 0; i < 5; i++) {
      last = await request.post("/api/auth/otp/email/verify", { headers: headers(ip), data: { code: bad } });
    }
    expect(last!.status()).toBe(429);
    expect((await last!.json()).reason).toBe("too_many_attempts");

    // Correct code no longer works — the code was invalidated.
    const after = await request.post("/api/auth/otp/email/verify", { headers: headers(ip), data: { code } });
    expect(after.status()).toBe(400);
  });

  test("rate limit: immediate resend hits cooldown (429)", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const first = await request.post("/api/auth/otp/email/send", { headers: headers(ip) });
    expect(first.status()).toBe(200);
    const second = await request.post("/api/auth/otp/email/send", { headers: headers(ip) });
    expect(second.status()).toBe(429);
    expect((await second.json()).cooldown).toBeGreaterThan(0);
  });

  test("security: send response never leaks the plaintext code", async ({ request }) => {
    const ip = nextIp();
    const { email } = await registerUser(request, ip);
    const send = await request.post("/api/auth/otp/email/send", { headers: headers(ip) });
    const raw = await send.text();
    const code = await peek(request, ip, "EMAIL", email);
    expect(code).toMatch(/^\d{6}$/);
    expect(raw.includes(code), "send response body must not contain the OTP").toBe(false);
  });
});

// --------------------------------------------------------------- MOBILE -----

test.describe("Mobile OTP", () => {
  test("happy path: send → correct code → verified", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const phone = uniquePhone();

    const send = await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone } });
    expect(send.status()).toBe(200);

    const code = await peek(request, ip, "MOBILE", phone);
    expect(code).toMatch(/^\d{6}$/);

    const verify = await request.post("/api/auth/otp/mobile/verify", { headers: headers(ip), data: { code } });
    expect(verify.status()).toBe(200);
    expect((await verify.json()).phoneVerified).toBe(true);
  });

  test("wrong code → 400 invalid with attempts remaining", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const phone = uniquePhone();
    await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone } });
    const code = await peek(request, ip, "MOBILE", phone);

    const res = await request.post("/api/auth/otp/mobile/verify", { headers: headers(ip), data: { code: wrongOf(code) } });
    expect(res.status()).toBe(400);
    expect((await res.json()).remaining).toBe(4);
  });

  test("expired code → 400 expired", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const phone = uniquePhone();
    await request.post("/api/auth/otp/mobile/send", { headers: headers(ip, { "x-otp-test-ttl": "0" }), data: { phone } });
    const code = await peek(request, ip, "MOBILE", phone);

    const res = await request.post("/api/auth/otp/mobile/verify", { headers: headers(ip), data: { code } });
    expect(res.status()).toBe(400);
    expect((await res.json()).reason).toBe("expired");
  });

  test("max attempts → lockout", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const phone = uniquePhone();
    await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone } });
    const code = await peek(request, ip, "MOBILE", phone);
    const bad = wrongOf(code);

    let last;
    for (let i = 0; i < 5; i++) {
      last = await request.post("/api/auth/otp/mobile/verify", { headers: headers(ip), data: { code: bad } });
    }
    expect(last!.status()).toBe(429);
    expect((await last!.json()).reason).toBe("too_many_attempts");
  });

  test("rate limit: immediate resend hits cooldown (429)", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const phone = uniquePhone();
    const first = await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone } });
    expect(first.status()).toBe(200);
    const second = await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone } });
    expect(second.status()).toBe(429);
  });

  test("invalid phone format → 400", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const res = await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone: "12345" } });
    expect(res.status()).toBe(400);
  });

  test("phone already in use by another account → 409", async ({ request }) => {
    const phone = uniquePhone();
    const ipA = nextIp();
    await registerUser(request, ipA);
    const a = await request.post("/api/auth/otp/mobile/send", { headers: headers(ipA), data: { phone } });
    expect(a.status()).toBe(200);

    // New account (new cookie via new register on a different IP) claims same phone.
    const ipB = nextIp();
    await registerUser(request, ipB);
    const b = await request.post("/api/auth/otp/mobile/send", { headers: headers(ipB), data: { phone } });
    expect(b.status()).toBe(409);
  });

  test("security: send response never leaks the plaintext code", async ({ request }) => {
    const ip = nextIp();
    await registerUser(request, ip);
    const phone = uniquePhone();
    const send = await request.post("/api/auth/otp/mobile/send", { headers: headers(ip), data: { phone } });
    const raw = await send.text();
    const code = await peek(request, ip, "MOBILE", phone);
    expect(raw.includes(code), "send response body must not contain the OTP").toBe(false);
  });
});
