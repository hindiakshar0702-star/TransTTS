/**
 * Tiny in-memory rate limiter — good enough for low-volume forms
 * (contact, signup magic-links, etc.) on a single Vercel function instance.
 *
 * Limitations:
 *   - State lives in the lambda's memory: a cold start resets counters.
 *   - Multiple concurrent function instances each have their own bucket,
 *     so the *effective* per-IP limit can be slightly higher than configured.
 *
 * For higher traffic / stricter limits, swap this to Upstash, Redis,
 * or Vercel KV. The function signature won't change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Remaining requests inside the current window (>= 0 even when ok=false). */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
  /** Seconds until the window resets — handy for `Retry-After` header. */
  retryAfterSeconds: number;
}

/**
 * @param key      Stable identifier — usually the requester's IP.
 * @param limit    Max requests allowed inside the window.
 * @param windowMs Window size in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return {
      ok: true,
      remaining: limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const ok = existing.count <= limit;
  return {
    ok,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Best-effort extraction of the client IP from request headers.
 * Falls back to "unknown" so callers can still produce a stable bucket key.
 */
export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    // x-forwarded-for can be comma-separated — first entry is the original client
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("fly-client-ip") ||
    "unknown"
  );
}
