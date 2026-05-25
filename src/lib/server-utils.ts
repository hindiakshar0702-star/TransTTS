import path from "path";
import fs from "fs";
import os from "os";

/**
 * Server-only filesystem helpers.
 *
 * Important: on Vercel/Lambda the project root is read-only. ONLY
 * `/tmp` (returned by `os.tmpdir()`) is writable, and even that is
 * per-instance and wiped at cold start.
 *
 * Therefore:
 *   - `getUploadsDir()` / `getGeneratedDir()` now point at `/tmp/<...>`.
 *   - Files written here are TRANSIENT — read them immediately, do NOT
 *     persist URLs that point back into them.
 *   - For long-lived audio, see `lib/tts.ts` which regenerates from DB.
 */

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Transient working directory for upload bodies (e.g. /api/transcribe).
 * Caller is responsible for cleaning up files when done.
 */
export function getUploadsDir(): string {
  const dir = path.join(os.tmpdir(), "transtts-uploads");
  ensureDir(dir);
  return dir;
}

/**
 * @deprecated Audio is now generated in-memory via `synthesizeMp3` in
 * `@/lib/tts`. Kept only so historical imports keep compiling — do not
 * use for new code.
 */
export function getGeneratedDir(): string {
  const dir = path.join(os.tmpdir(), "transtts-generated");
  ensureDir(dir);
  return dir;
}
