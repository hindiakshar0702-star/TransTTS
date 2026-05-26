import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client.
 *
 * Production safety:
 *   - Lazy-initialised so a missing DATABASE_URL does NOT crash imports.
 *     The client is only constructed on first use; if construction
 *     fails (for example because the env var is missing), we cache the
 *     error and return null from `getPrisma()` so callers can choose
 *     to gracefully degrade.
 *
 *   - Use `prisma` for the convenient default export (legacy callers).
 *     Use `getPrisma()` / `tryDbWrite()` in new code where you want
 *     the user-facing feature to work even when the DB is misconfigured.
 *
 * Why graceful degradation matters here:
 *   The only thing the DB stores for /api/tts, /api/translate and
 *   /api/transcribe is a "history" row used by the dashboard. The
 *   actual feature output (audio, translated text, transcript) is
 *   computed independently. Dropping a history row is annoying;
 *   500-ing the user request because of a missing env var is broken.
 */

type GlobalWithPrisma = typeof globalThis & {
  __prisma?: PrismaClient | null;
  __prismaInitTried?: boolean;
};
const g = globalThis as GlobalWithPrisma;

function tryInitPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[prisma] DATABASE_URL is not set — DB-backed history will be skipped. " +
          "See DEPLOYMENT.md to configure Postgres on Vercel.",
      );
    }
    return null;
  }
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  } catch (err) {
    console.error("[prisma] Failed to initialise client:", err);
    return null;
  }
}

/**
 * Returns the shared Prisma client, or null if it could not be initialised
 * (typically because DATABASE_URL is missing). Caches the answer for the
 * lifetime of the Node process.
 */
export function getPrisma(): PrismaClient | null {
  if (!g.__prismaInitTried) {
    g.__prisma = tryInitPrisma();
    g.__prismaInitTried = true;
  }
  return g.__prisma ?? null;
}

/**
 * Run a Prisma write that should be best-effort — if the DB is
 * unavailable we log and continue. The return value is whatever
 * the callback returned, or null on failure.
 *
 * Designed for "fire-and-forget" history writes that must NEVER
 * block or fail the user-facing API call.
 */
export async function tryDbWrite<T>(
  fn: (db: PrismaClient) => Promise<T>,
  context = "db",
): Promise<T | null> {
  const db = getPrisma();
  if (!db) return null;
  try {
    return await fn(db);
  } catch (err) {
    console.warn(`[${context}] Prisma write skipped:`, err);
    return null;
  }
}

/**
 * Default export — shaped like the old `import prisma from "@/lib/prisma"`
 * usage so existing route handlers keep working. Reads now throw if the
 * client couldn't be initialised, so callers SHOULD migrate to
 * `getPrisma()` / `tryDbWrite()` for graceful degradation.
 *
 * We use a Proxy so the singleton is constructed lazily on first
 * property access — pure imports are still cheap and won't crash
 * when DATABASE_URL is missing.
 */
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    if (!client) {
      throw new Error(
        "[prisma] DATABASE_URL is not set. " +
          "Add it to .env (local) or Vercel project env vars (production). " +
          "See DEPLOYMENT.md.",
      );
    }
    return (client as unknown as Record<string | symbol, unknown>)[
      prop as string | symbol
    ];
  },
}) as PrismaClient;

export default prisma;
