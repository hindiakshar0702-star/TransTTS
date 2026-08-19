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
      this.wasmModule._rnnoise_process_frame(this.rnnoiseState, this.outPtr, this.inPtr);

      for (let j = 0; j < FRAME_SIZE; j++) {
        this.outputBuffer[this.outputWriteIndex] = heap[outOffset + j] / PCM16_SCALE;
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
