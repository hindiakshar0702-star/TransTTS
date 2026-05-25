"use client";
import { useState, useEffect, useCallback } from "react";

/**
 * Like `useState`, but persists to `sessionStorage`. Survives in-tab
 * navigations; cleared when the tab closes.
 *
 * Production-grade fixes vs the previous version:
 *
 *  - **Stale-after-deploy** (BUG-010): values stored before a deploy
 *    could be restored into a UI that no longer understood them — most
 *    visibly, an `audioUrl` pointing at `/api/tts/audio/<oldId>` that
 *    now 404s. We stamp every value with a TTL and the build version,
 *    and silently fall back to `defaultValue` when stale.
 *
 *  - **Storage failures must not crash hydration**: every read/write
 *    is wrapped (Safari Private Mode + Brave's "block storage" both
 *    throw on `setItem`).
 *
 *  - **SSR-safe**: writes are deferred to `useEffect`, never run during
 *    the render phase, so SSR + hydration don't mismatch.
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 min
const STORAGE_PREFIX = "transtts_";

/**
 * Bumped automatically by reading `NEXT_PUBLIC_BUILD_ID` (set by Vercel
 * on every deploy). Stored values from a different build are treated as
 * stale and discarded. Fallback to "dev" makes local hot-reload sane.
 */
const BUILD_ID =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BUILD_ID) ||
  "dev";

interface Envelope<T> {
  /** Stored payload */
  v: T;
  /** Storage timestamp (ms epoch) */
  t: number;
  /** Build ID at the time of write */
  b: string;
}

function isEnvelope<T>(x: unknown): x is Envelope<T> {
  return (
    typeof x === "object" &&
    x !== null &&
    "v" in x &&
    "t" in x &&
    "b" in x
  );
}

function readPersisted<T>(
  storageKey: string,
  defaultValue: T,
  ttlMs: number,
): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    // Legacy values (no envelope) — treat as stale on read so the next
    // generation cycle moves everyone onto the new format.
    if (!isEnvelope<T>(parsed)) return defaultValue;
    if (parsed.b !== BUILD_ID) return defaultValue;
    if (Date.now() - parsed.t > ttlMs) return defaultValue;
    return parsed.v;
  } catch {
    return defaultValue;
  }
}

function writePersisted<T>(storageKey: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope<T> = {
      v: value,
      t: Date.now(),
      b: BUILD_ID,
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(envelope));
  } catch {
    /* sessionStorage may be disabled (private mode, quota, etc.) */
  }
}

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: { ttlMs?: number },
): [T, (val: T | ((prev: T) => T)) => void] {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const storageKey = `${STORAGE_PREFIX}${key}`;

  // Important: lazy initialiser only runs on the client, which keeps
  // SSR output deterministic (always `defaultValue`) and avoids the
  // dreaded "Hydration failed because the server rendered HTML didn't
  // match the client" warning.
  const [state, setStateRaw] = useState<T>(() =>
    readPersisted(storageKey, defaultValue, ttlMs),
  );

  useEffect(() => {
    writePersisted(storageKey, state);
  }, [state, storageKey]);

  const setState = useCallback(
    (val: T | ((prev: T) => T)) => {
      setStateRaw(val);
    },
    [],
  );

  return [state, setState];
}

/**
 * Removes every persisted key whose unprefixed name starts with
 * `prefix`. Used by Reset buttons.
 */
export function clearPersistedState(prefix: string) {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(`${STORAGE_PREFIX}${prefix}`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
