"use client";
import { useEffect } from "react";

/**
 * Registers the service worker (offline fallback + static caching).
 * Production-only: a SW in dev caches Turbopack/HMR output and breaks fast
 * refresh. The SW file itself lives at /public/sw.js and controls scope "/".
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures are non-fatal — app still works online */
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
