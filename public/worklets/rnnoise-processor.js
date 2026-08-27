// public/worklets/rnnoise-processor.js
//
// Real-time RNNoise denoiser running on the audio thread.
//
// Import order matters: the shim installs the worker globals that the RNNoise
// emscripten glue reads while it evaluates, so it has to run first.
import "./rnnoise-shim.js";
import "./rnnoise-sync.js";

/** RNNoise processes exactly this many samples per call, at 48 kHz (10 ms). */
const FRAME_SIZE = 480;

/**
 * RNNoise operates on float samples in 16-bit PCM range, not on the -1..1
 * floats the Web Audio API hands out. Feeding it normalised floats leaves the
 * signal essentially untouched — measured against this very build, a noisy
 * test tone came back 0.05 dB different (i.e. a no-op), while the same input
 * scaled by 32768 came back 5.9 dB quieter.
 */
const PCM16_SCALE = 32768;

/** Power of two so the read/write indices can wrap with a mask. */
const RING_SIZE = 2048;
const RING_MASK = RING_SIZE - 1;

/**
 * Residual-noise floor.
 *
 * RNNoise alone measured 7.8 dB of noise reduction on a real 41 s recording —
 * audibly cleaner, but the hiss is still there, because RNNoise suppresses
 * noise rather than removing it. Riding the gain on its own speech probability
 * takes that to 12.1 dB.
 *
 * These constants are the conservative end of a measured sweep. A -14 dB floor
 * reached 14.5 dB of reduction but clipped the quietest speech by the same
 * 14 dB; -10 dB never mutes anything, costs 1.0 dB on speech overall, and
 * leaves a little room tone rather than the unnatural dead silence a hard gate
 * produces.
 */
const NOISE_FLOOR_GAIN = 0.32;

/** Speech probability that opens the gate, and the lower one that closes it. */
const VAD_OPEN = 0.5;
const VAD_CLOSE = 0.05;

/**
 * Frames to hold the gate open after speech stops (10 ms each). Long enough to
 * carry trailing consonants and the gaps between words, which is what a
 * threshold on its own chews off.
 */
const VAD_HANGOVER_FRAMES = 80;

/** Open fast so onsets survive; close slowly so the floor fades in. */
const GAIN_ATTACK = 0.05;
const GAIN_RELEASE = 0.0008;

class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.alive = true;
    this.wasmReady = false;
    this.wasmModule = null;
    this.rnnoiseState = 0;
    this.inPtr = 0;
    this.outPtr = 0;

    this.inputBuffer = new Float32Array(FRAME_SIZE);
    this.inputBufferLength = 0;

    this.outputBuffer = new Float32Array(RING_SIZE);
    this.outputWriteIndex = 0;
    this.outputReadIndex = 0;

    // Gate state. Starts open so the first words are never swallowed while the
    // speech probability is still settling.
    this.gateGain = 1;
    this.gateOpen = true;
    this.gateHang = VAD_HANGOVER_FRAMES;

    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "close") this.cleanup();
    };

    try {
      if (typeof createRNNWasmModuleSync !== "function") {
        throw new Error("createRNNWasmModuleSync is not defined — rnnoise-sync.js did not load");
      }

      // Despite the emscripten convention of returning a promise, this build
      // is synchronous: it returns the module object itself. Calling .then()
      // on it throws and takes the whole processor down with it.
      const module = createRNNWasmModuleSync();

      this.wasmModule = module;
      this.rnnoiseState = module._rnnoise_create(0);
      if (!this.rnnoiseState) throw new Error("rnnoise_create returned a null state");

      this.inPtr = module._malloc(FRAME_SIZE * 4);
      this.outPtr = module._malloc(FRAME_SIZE * 4);
      this.wasmReady = true;

      // Lets the UI say whether denoising is genuinely running rather than
      // assuming it is.
      this.port.postMessage({ type: "ready" });
    } catch (err) {
      this.port.postMessage({ type: "error", message: String(err && err.message ? err.message : err) });
    }
  }

  cleanup() {
    this.alive = false;
    if (this.wasmReady && this.wasmModule) {
      try {
        this.wasmModule._free(this.inPtr);
        this.wasmModule._free(this.outPtr);
        this.wasmModule._rnnoise_destroy(this.rnnoiseState);
      } catch {
        // Nothing useful to do on the audio thread if teardown fails.
      }
      this.wasmReady = false;
    }
  }

  process(inputs, outputs) {
    if (!this.alive) return false;

    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const inputChannel = input[0];
    const blockSize = inputChannel.length;

    // Until the wasm is up, stay transparent rather than emitting silence.
    if (!this.wasmReady || !this.wasmModule) {
      for (let c = 0; c < output.length; c++) output[c].set(inputChannel);
      return true;
    }

    const heap = this.wasmModule.HEAPF32;
    const inOffset = this.inPtr >> 2;
    const outOffset = this.outPtr >> 2;

    for (let i = 0; i < blockSize; i++) {
      this.inputBuffer[this.inputBufferLength++] = inputChannel[i] * PCM16_SCALE;
      if (this.inputBufferLength < FRAME_SIZE) continue;

      heap.set(this.inputBuffer, inOffset);
      // The return value is RNNoise's own speech probability for this frame.
      const speechProbability = this.wasmModule._rnnoise_process_frame(
        this.rnnoiseState,
        this.outPtr,
        this.inPtr
      );

      if (speechProbability >= VAD_OPEN) {
        this.gateOpen = true;
        this.gateHang = VAD_HANGOVER_FRAMES;
      } else if (this.gateHang > 0) {
        this.gateHang--;
      } else if (speechProbability < VAD_CLOSE) {
        this.gateOpen = false;
      }

      const target = this.gateOpen ? 1 : NOISE_FLOOR_GAIN;
      const coefficient = target > this.gateGain ? GAIN_ATTACK : GAIN_RELEASE;

      for (let j = 0; j < FRAME_SIZE; j++) {
        // Ramped per sample: stepping the gain at frame edges would click.
        this.gateGain += (target - this.gateGain) * coefficient;
        this.outputBuffer[this.outputWriteIndex] = (heap[outOffset + j] / PCM16_SCALE) * this.gateGain;
        this.outputWriteIndex = (this.outputWriteIndex + 1) & RING_MASK;
      }

      this.inputBufferLength = 0;
    }

    const available = (this.outputWriteIndex - this.outputReadIndex) & RING_MASK;
    if (available >= blockSize) {
      for (let i = 0; i < blockSize; i++) {
        const val = this.outputBuffer[this.outputReadIndex];
        this.outputReadIndex = (this.outputReadIndex + 1) & RING_MASK;
        for (let c = 0; c < output.length; c++) output[c][i] = val;
      }
    } else {
      // Priming the first frame costs a few blocks of silence, once.
      for (let c = 0; c < output.length; c++) output[c].fill(0);
    }

    return true;
  }
}

registerProcessor("rnnoise-processor", RNNoiseProcessor);
