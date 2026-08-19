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
      return { rmsIn, changeDb: 20 * Math.log10(rmsOut / rmsIn) };
    }, SR);

    // Sanity: the fixture really did carry signal.
    expect(result.rmsIn).toBeGreaterThan(0.05);

    // Unscaled input measured 0.05 dB on this build — indistinguishable from a
    // no-op. Anything past a few dB of attenuation means the frames genuinely
    // reached the model.
    expect(result.changeDb).toBeLessThan(-6);
  });
});
