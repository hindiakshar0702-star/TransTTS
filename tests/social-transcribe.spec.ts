import { test, expect, type APIRequestContext } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

/**
 * Non-blocking upload + social-video transcription — API-level tests.
 *
 * No real social platform is ever contacted with a genuine video: the happy
 * path uses a syntactically valid but non-existent YouTube URL, so yt-dlp
 * fails fast and the background pipeline marks the job as errored — which is
 * exactly the graceful-degradation path we want to verify. The non-blocking
 * contract (202 + jobId immediately, progress via /api/jobs/:id) is asserted
 * with wall-clock timing.
 */

async function signUp(request: APIRequestContext): Promise<void> {
  // Register + Auth.js credentials sign-in (register no longer auto-sessions).
  await registerAndSignIn(request, { emailPrefix: "pw-social" });
}

test.describe("social-transcribe API", () => {
  test("rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/social-transcribe", {
      data: { url: "https://www.youtube.com/watch?v=abc" },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects unsupported URLs with a helpful message", async ({ request }) => {
    await signUp(request);
    const res = await request.post("/api/social-transcribe", {
      data: { url: "https://example.com/video.mp4" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("YouTube");
  });

  test("rejects invalid language codes", async ({ request }) => {
    await signUp(request);
    const res = await request.post("/api/social-transcribe", {
      data: { url: "https://www.youtube.com/watch?v=abc", language: "no;pe" },
    });
    expect(res.status()).toBe(400);
  });

  test("non-blocking contract: 202 + jobId returned immediately, job resolves in background", async ({ request }) => {
    await signUp(request);

    const started = Date.now();
    const res = await request.post("/api/social-transcribe", {
      data: {
        // Valid platform, non-existent video: download fails in the background.
        url: "https://www.youtube.com/watch?v=zz_pw_mock_zz",
        language: "auto",
        translateToHindi: true,
      },
    });
    const intakeMs = Date.now() - started;

    expect(res.status()).toBe(202);
    // Intake must return without waiting for download/transcription.
    expect(intakeMs).toBeLessThan(5000);

    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    expect(body.platform).toBe("youtube");
    expect(body.status).toBe("processing");

    // Poll the job like the UI does; the pipeline must settle it to "error"
    // (graceful) — never hang in "processing" forever, never 500 the poll.
    let status = "processing";
    for (let i = 0; i < 30 && status === "processing"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const jr = await request.get(`/api/jobs/${body.jobId}`);
      expect(jr.ok()).toBeTruthy();
      status = (await jr.json()).status;
    }
    expect(status).toBe("error");
  });
});

test.describe("upload transcribe API (non-blocking intake)", () => {
  test("rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/transcribe", {
      multipart: { language: "auto" },
    });
    expect(res.status()).toBe(401);
  });

  test("intake responds fast with 202 + jobId (processing happens in background)", async ({ request }) => {
    await signUp(request);

    // Minimal valid WAV (RIFF/WAVE header + a little silence) — passes the
    // server's magic-number sniff without any external fixture file.
    const sampleRate = 8000;
    const dataLen = sampleRate; // 0.5s of 16-bit silence
    const buf = Buffer.alloc(44 + dataLen);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataLen, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataLen, 40);

    const started = Date.now();
    const res = await request.post("/api/transcribe", {
      multipart: {
        file: { name: "silence.wav", mimeType: "audio/wav", buffer: buf },
        language: "auto",
      },
    });
    const intakeMs = Date.now() - started;

    // Either 202 (accepted; Whisper key configured or not, intake is the same)
    // or 400 only when no API key is configured on this machine.
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toContain("API key");
      return;
    }
    expect(res.status()).toBe(202);
    expect(intakeMs).toBeLessThan(5000); // never waits for Whisper
    const body = await res.json();
    expect(body.jobId).toBeTruthy();

    // The job row is immediately pollable.
    const jr = await request.get(`/api/jobs/${body.jobId}`);
    expect(jr.ok()).toBeTruthy();
    const job = await jr.json();
    expect(["processing", "completed", "error"]).toContain(job.status);
  });

  test("rejects a non-media file by content sniffing", async ({ request }) => {
    await signUp(request);
    const res = await request.post("/api/transcribe", {
      multipart: {
        file: { name: "fake.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("<html>not audio at all</html>padding-padding") },
        language: "auto",
      },
    });
    // 415 unsupported media (or 400 when no API key is configured — checked first).
    expect([415, 400]).toContain(res.status());
  });
});
