import { test, expect } from "@playwright/test";

/**
 * Guards the RNNoise denoiser end to end, in a real browser, because every one
 * of the bugs it replaced failed *silently*: the recorder kept working, the
 * banner kept claiming "AI Noise Removal Active", and only the recording gave
 * it away.
 *
 * The worklet used to die three separate ways before it could denoise
 * anything — `importScripts` does not exist in an AudioWorkletGlobalScope, the
 * emscripten glue reads worker globals (`self`, `location`) that scope does not
 * have, and this build of the loader is synchronous so calling `.then()` on it
 * threw. All three surface here as "the processor never reports ready".
 *
 * The last bug was quieter still: RNNoise wants float samples in 16-bit PCM
 * range, and the worklet was handing it the -1..1 floats Web Audio produces.
 * Everything loaded, nothing was denoised. That one is caught by measuring
 * actual attenuation rather than by checking that the graph runs.
 */

/** Sample rate RNNoise's model is trained for. */
const SR = 48000;

test.describe("RNNoise worklet", () => {
  test("registers and brings its wasm up", async ({ page }) => {
    await page.goto("/record");

    const report = await page.evaluate(async () => {
      const ctx = new AudioContext();
      await ctx.audioWorklet.addModule("/worklets/rnnoise-processor.js");
      const node = new AudioWorkletNode(ctx, "rnnoise-processor");
      return new Promise<unknown>((resolve) => {
        const timer = setTimeout(() => resolve({ type: "timeout" }), 8000);
        node.port.onmessage = (event) => {
          clearTimeout(timer);
          resolve(event.data);
        };
      });
    });

    expect(report).toEqual({ type: "ready" });
  });

  test("attenuates broadband noise, which a wrongly scaled input would not", async ({ page }) => {
    await page.goto("/record");

    const result = await page.evaluate(async (sampleRate) => {
      const seconds = 3;
      const frames = sampleRate * seconds;
      const ctx = new OfflineAudioContext(1, frames, sampleRate);
      await ctx.audioWorklet.addModule("/worklets/rnnoise-processor.js");
      const node = new AudioWorkletNode(ctx, "rnnoise-processor");

      // Speechless broadband hiss: RNNoise's whole job is to push this down.
      const buffer = ctx.createBuffer(1, frames, sampleRate);
      const input = buffer.getChannelData(0);
      // Deterministic pseudo-random so the assertion cannot flake on a bad draw.
      let seed = 12345;
      for (let i = 0; i < frames; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        input[i] = (seed / 0x3fffffff - 1) * 0.2;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(node);
      node.connect(ctx.destination);
      source.start();

      const output = (await ctx.startRendering()).getChannelData(0);

      // Skip the first second: the ring buffer primes and RNNoise's noise
      // estimate needs a moment to settle.
      const from = sampleRate;
      let inSum = 0;
      let outSum = 0;
      for (let i = from; i < frames; i++) {
        inSum += input[i] * input[i];
        outSum += output[i] * output[i];
      }
      const count = frames - from;
      const rmsIn = Math.sqrt(inSum / count);
      const rmsOut = Math.sqrt(outSum / count);

      // A stepped gain would show up as a discontinuity far larger than the
      // signal's own sample-to-sample movement.
      let maxJump = 0;
      let zeros = 0;
      for (let i = from + 1; i < frames; i++) {
        const jump = Math.abs(output[i] - output[i - 1]);
        if (jump > maxJump) maxJump = jump;
        if (output[i] === 0) zeros++;
      }

      return {
        rmsIn,
        changeDb: 20 * Math.log10(rmsOut / rmsIn),
        maxJump,
        silenceRatio: zeros / count,
      };
    }, SR);

    // Sanity: the fixture really did carry signal.
    expect(result.rmsIn).toBeGreaterThan(0.05);

    // Unscaled input measured 0.05 dB on this build — indistinguishable from a
    // no-op. Anything past a few dB of attenuation means the frames genuinely
    // reached the model.
    expect(result.changeDb).toBeLessThan(-6);

    // The residual-noise gate must fade, never mute or step: digital silence
    // sounds broken, and a stepped gain clicks once per 10 ms frame.
    expect(result.silenceRatio).toBeLessThan(0.01);
    expect(result.maxJump).toBeLessThan(0.2);
  });
});

/**
 * The rumble filter that sits in front of the denoiser.
 *
 * RNNoise is a model, not a filter: it will pass a 40 Hz hum straight through
 * to the encoder. Air conditioning, traffic and desk vibration all live below
 * where speech starts, so a high-pass ahead of it is cheap insurance.
 *
 * Two things here are easy to get wrong and silent when wrong.
 *
 * The corner has to stay below the lowest male fundamental (~85 Hz). Raising it
 * to chase a specific noise is a trap — the knock that prompted this filter
 * peaked at 129 Hz, and a corner high enough to catch that removes the voice
 * too.
 *
 * And Web Audio reads a highpass's `Q` in DECIBELS rather than as a Q factor,
 * so the reflex value of 0.707 is not the flat Butterworth response it looks
 * like: it lifts 100 Hz by 1.7 dB, precisely where those fundamentals sit.
 */
test.describe("rumble filter", () => {
  const CORNER = 75;

  async function response(page: import("@playwright/test").Page, q: number, freqs: number[]) {
    return page.evaluate(
      ({ q, freqs, corner }) => {
        const ctx = new OfflineAudioContext(1, 128, 48000);
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = corner;
        filter.Q.value = q;

        const input = new Float32Array(freqs);
        const mag = new Float32Array(freqs.length);
        const phase = new Float32Array(freqs.length);
        filter.getFrequencyResponse(input, mag, phase);
        return Array.from(mag, (m) => 20 * Math.log10(m || 1e-12));
      },
      { q, freqs, corner: CORNER }
    );
  }

  test("cuts what lies below speech", async ({ page }) => {
    await page.goto("/record");
    const [at20, at40, at60] = await response(page, 0, [20, 40, 60]);
    expect(at20).toBeLessThan(-18); // deep rumble, near-gone
    expect(at40).toBeLessThan(-8); // mains-adjacent hum and desk vibration
    expect(at60).toBeLessThan(-1);
  });

  test("leaves the voice alone, lowest male fundamentals included", async ({ page }) => {
    await page.goto("/record");
    const [at85, at129, at200, at1k] = await response(page, 0, [85, 129, 200, 1000]);
    for (const gain of [at85, at129, at200, at1k]) {
      expect(Math.abs(gain)).toBeLessThan(2);
    }
  });

  test("Q stays at the flattest setting, because Web Audio reads it in dB", async ({ page }) => {
    await page.goto("/record");
    const flat = Math.max(...(await response(page, 0, [85, 100, 129])));
    const reflex = Math.max(...(await response(page, 0.707, [85, 100, 129])));
    // The "obvious" Butterworth value is measurably peakier than zero here.
    expect(reflex).toBeGreaterThan(flat);
    expect(flat).toBeLessThan(1.5);
  });
});
