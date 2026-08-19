// Globals the RNNoise emscripten glue expects, which AudioWorkletGlobalScope
// does not provide.
//
// rnnoise-sync.js is built for a worker/browser environment: it reads
// `self.location.href` while probing for its script directory and publishes
// itself with `self.createRNNWasmModuleSync = ...` at the end. An
// AudioWorkletGlobalScope has neither `self` nor `location`, so loading the
// glue there throws "ReferenceError: self is not defined" before it can
// register anything.
//
// This module must be imported BEFORE rnnoise-sync.js — side-effect imports
// evaluate in source order, so the import list in rnnoise-processor.js is
// load-bearing, not stylistic.

globalThis.self = globalThis;

if (!globalThis.location) {
  // Only ever read for the script directory, which the glue does not need:
  // the wasm binary is embedded in rnnoise-sync.js as a base64 data URI.
  globalThis.location = { href: "" };
}

if (!globalThis.setTimeout) {
  // The glue defers its start-up through setTimeout. A microtask is enough and
  // avoids pulling a timer into the audio thread.
  globalThis.setTimeout = (fn) => {
    Promise.resolve().then(fn);
    return 0;
  };
}

if (!globalThis.clearTimeout) {
  globalThis.clearTimeout = () => {};
}
