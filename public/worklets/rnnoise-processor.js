// public/worklets/rnnoise-processor.js

// Import the synchronous RNNoise WASM module loader
importScripts('/worklets/rnnoise-sync.js');

class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.alive = true;
    this.wasmReady = false;
    this.wasmModule = null;
    this.rnnoiseState = 0;
    this.inPtr = 0;
    this.outPtr = 0;

    // Fixed-size accumulation buffer
    this.inputBuffer = new Float32Array(480);
    this.inputBufferLength = 0;

    // Pre-allocated circular buffer for output queue (power of 2 for fast masking)
    this.outputBuffer = new Float32Array(2048);
    this.outputWriteIndex = 0;
    this.outputReadIndex = 0;

    // Initialize RNNoise WASM synchronously
    if (typeof createRNNWasmModuleSync === 'function') {
      createRNNWasmModuleSync()
        .then((module) => {
          // Prevent memory leak if processor was closed before WASM resolved
          if (!this.alive) return;

          this.wasmModule = module;
          this.rnnoiseState = module._rnnoise_create(0);
          this.inPtr = module._malloc(480 * 4); // 480 floats (4 bytes each)
          this.outPtr = module._malloc(480 * 4);
          this.wasmReady = true;
        })
        .catch((err) => {
          console.error('Failed to initialize RNNoise WASM inside AudioWorklet:', err);
        });
    } else {
      console.error('createRNNWasmModuleSync is not defined. Ensure rnnoise-sync.js is loaded.');
    }

    // Handle messages (e.g. destruction)
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'close') {
        this.cleanup();
      }
    };
  }

  cleanup() {
    this.alive = false;
    if (this.wasmReady && this.wasmModule) {
      try {
        this.wasmModule._free(this.inPtr);
        this.wasmModule._free(this.outPtr);
        this.wasmModule._rnnoise_destroy(this.rnnoiseState);
      } catch (err) {
        console.error('Error during RNNoise cleanup:', err);
      }
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.alive) {
      return false;
    }

    const input = inputs[0];
    const output = outputs[0];

    // If no input or output channel is available, skip
    if (!input || input.length === 0 || !output || output.length === 0) {
      return true;
    }

    const inputChannel = input[0]; // Mono input channel
    const outputSize = inputChannel.length; // usually 128

    // If WASM is not loaded yet, do a simple pass-through
    if (!this.wasmReady || !this.wasmModule) {
      for (let c = 0; c < output.length; c++) {
        output[c].set(inputChannel);
      }
      return true;
    }

    // 1. Accumulate input samples into inputBuffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.inputBuffer[this.inputBufferLength] = inputChannel[i];
      this.inputBufferLength++;

      // When we hit 480 samples, process the frame
      if (this.inputBufferLength === 480) {
        // Copy to WASM input pointer
        this.wasmModule.HEAPF32.set(this.inputBuffer, this.inPtr / 4);

        // Process frame
        this.wasmModule._rnnoise_process_frame(this.rnnoiseState, this.outPtr, this.inPtr);

        // Read out denoised samples from WASM output pointer
        const denoisedFrame = this.wasmModule.HEAPF32.subarray(
          this.outPtr / 4,
          (this.outPtr / 4) + 480
        );

        // Append denoised samples to the circular output buffer
        for (let j = 0; j < denoisedFrame.length; j++) {
          this.outputBuffer[this.outputWriteIndex] = denoisedFrame[j];
          this.outputWriteIndex = (this.outputWriteIndex + 1) & 2047; // Fast wrap-around mask (2048 - 1)
        }

        // Reset accumulation index
        this.inputBufferLength = 0;
      }
    }

    // 2. Write from circular outputBuffer to output channels
    const availableSamples = (this.outputWriteIndex - this.outputReadIndex) & 2047;
    if (availableSamples >= outputSize) {
      // Copy directly from circular buffer to all output channels (No allocation!)
      for (let i = 0; i < outputSize; i++) {
        const val = this.outputBuffer[this.outputReadIndex];
        this.outputReadIndex = (this.outputReadIndex + 1) & 2047;
        for (let c = 0; c < output.length; c++) {
          output[c][i] = val;
        }
      }
    } else {
      // Output silence if there aren't enough samples yet
      for (let c = 0; c < output.length; c++) {
        output[c].fill(0);
      }
    }

    return true;
  }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
