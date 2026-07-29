import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight in-memory abuse controls for the public, cost-bearing API routes
 * (transcribe / tts / translate). This is defense-in-depth, NOT a replacement
 * for real per-user auth — the app currently has only a client-side mock login,
 * so there is no trusted user identity to key on server-side yet. Until a real
 * session/token system exists, we protect the expensive endpoints with:
 *   1. Same-origin enforcement (blocks trivial cross-site quota theft).
 *   2. Per-IP sliding-window rate limiting (blocks flooding from one source).
 *
 * NOTE: the in-memory store resets on redeploy and is per-instance. For a
 * horizontally-scaled deployment, back this with Redis/Upstash instead.
 */

interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the Map cannot grow unbounded.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Reject cross-site POSTs. Browsers always send Origin on cross-origin (and
 * same-origin non-GET) fetches, so a mismatch means the call did not come from
 * our own pages. Requests with no Origin AND no Referer are allowed through to
 * the rate limiter (e.g. curl / server-to-server), which still caps abuse.
 */
export function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return true;

  const source = origin || referer;
  if (!source) return true; // no browser context — leave it to the rate limiter

  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/**
 * Sliding-window-ish fixed-window limiter. Returns null when allowed, or a 429
 * NextResponse when the caller is over budget.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (hit.count >= limit) {
    const retryAfter = Math.ceil((hit.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  hit.count += 1;
  return null;
}

/**
 * One-call guard for an API route. `scope` namespaces the limiter so each route
 * gets its own budget. Returns a NextResponse to return early, or null to proceed.
 */
export function guard(
  req: NextRequest,
  scope: string,
  opts: { limit: number; windowMs: number }
): NextResponse | null {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const ip = getClientIp(req);
  return rateLimit(`${scope}:${ip}`, opts.limit, opts.windowMs);
}
