"use client";
import { useState, useEffect, useCallback } from "react";

/**
 * Like useState, but persists to sessionStorage.
 * When navigating away and back, the state is restored.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const storageKey = `transtts_${key}`;

  const [state, setStateRaw] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as T;
    } catch { /* ignore */ }
    return defaultValue;
  });

  // Save to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state, storageKey]);

  const setState = useCallback((val: T | ((prev: T) => T)) => {
    setStateRaw(val);
  }, []);

  return [state, setState];
}

/**
 * Clear all persisted state for a given page prefix
 */
export function clearPersistedState(prefix: string) {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(`transtts_${prefix}`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}
