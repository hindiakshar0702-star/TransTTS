import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Tiny shared-secret guard for "operator only" endpoints
 * (clear all jobs, list contact inquiries, etc.).
 *
 * We deliberately avoid framework-coupled helpers so this file works
 * identically in any Node runtime route handler.
 *
 * Token can be passed via (in priority order):
 *   1. `Authorization: Bearer <token>` header
 *   2. `x-admin-token` header
 *   3. `?token=<token>` query string
 *
 * Comparison is constant-time (`timingSafeEqual`) to defeat the
 * trivial timing oracle on `===`.
 */

export interface AdminAuthOk {
  ok: true;
}
export interface AdminAuthFail {
  ok: false;
  status: 401 | 503;
  message: string;
}
export type AdminAuthResult = AdminAuthOk | AdminAuthFail;

function extractToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (bearer) return bearer;

  const header = req.headers.get("x-admin-token");
  if (header) return header;

  return req.nextUrl.searchParams.get("token") || "";
}

/**
 * Pure check — returns the result, never throws, never sends a response.
 * Use this in routes that need to return a custom payload alongside a 401.
 */
export function checkAdmin(req: NextRequest): AdminAuthResult {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      message:
        "Admin endpoint not configured. Set the ADMIN_TOKEN environment variable.",
    };
  }

  const provided = extractToken(req);
  if (!provided) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: missing admin token.",
    };
  }

  // Length differences would leak via the timing-safe call below if we
  // didn't normalise here — Buffer.from() of two different lengths
  // throws inside timingSafeEqual.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  if (!timingSafeEqual(a, b)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  return { ok: true };
}

/**
 * Sugar — returns `null` on success, or a ready-to-return
 * `NextResponse` on failure. Lets routes write:
 *
 *   const denied = requireAdmin(req);
 *   if (denied) return denied;
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const result = checkAdmin(req);
  if (result.ok) return null;
  return NextResponse.json({ error: result.message }, { status: result.status });
}
