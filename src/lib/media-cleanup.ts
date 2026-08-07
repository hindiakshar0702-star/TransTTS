import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { getGeneratedDir, getUploadsDir } from "@/lib/server-utils";

/**
 * Disk housekeeping for the two media directories.
 *
 * Nothing used to delete these. `generated/` only shrank when a user manually
 * cleared their history, and `uploads/` kept whatever a crashed transcription
 * left behind, so both grew without bound until the disk filled.
 *
 * Two different lifetimes, because the directories mean different things:
 *   uploads/    scratch. A file here is mid-transcription; anything older than
 *               an hour belongs to a run that already died.
 *   generated/  user-facing TTS audio, served back by /api/tts/audio/[id].
 *               Kept for a week, then removed — and the owning Job row has its
 *               audioUrl cleared in the same pass so the UI never offers a
 *               play button for a file that is gone.
 *
 * Node-only (fs + prisma). Never import from middleware.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How long generated TTS audio is retained. */
const GENERATED_TTL_MS = Number(process.env.MEDIA_TTL_DAYS || 7) * DAY_MS;
/** How long an in-flight upload may sit before it counts as abandoned. */
const UPLOAD_TTL_MS = HOUR_MS;
/** Minimum gap between sweeps in one process. */
const SWEEP_INTERVAL_MS = HOUR_MS;

let lastSweepAt = 0;
let sweepInFlight: Promise<CleanupResult> | null = null;

export interface CleanupResult {
  generatedDeleted: number;
  uploadsDeleted: number;
  jobsCleared: number;
  bytesFreed: number;
}

const EMPTY: CleanupResult = {
  generatedDeleted: 0,
  uploadsDeleted: 0,
  jobsCleared: 0,
  bytesFreed: 0,
};

/**
 * Delete entries under `dir` whose mtime is older than `ttlMs`.
 * Returns the basenames removed and how many bytes that reclaimed.
 * Individual failures are skipped — one locked file must not abort the sweep.
 */
async function sweepDir(
  dir: string,
  ttlMs: number
): Promise<{ removed: string[]; bytes: number }> {
  const removed: string[] = [];
  let bytes = 0;

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { removed, bytes }; // directory not created yet
  }

  const cutoff = Date.now() - ttlMs;

  for (const name of entries) {
    // Keep the directory listing itself boring — never follow anything odd.
    if (name.startsWith(".")) continue;

    const full = path.join(dir, name);
    try {
      const stat = await fs.lstat(full);
      if (stat.mtimeMs >= cutoff) continue;

      if (stat.isDirectory()) {
        // TTS writes into a per-id temp dir before renaming the result out; a
        // crash between those steps leaves the directory behind.
        await fs.rm(full, { recursive: true, force: true });
      } else {
        await fs.unlink(full);
        bytes += stat.size;
      }
      removed.push(name);
    } catch {
      // Busy, already gone, or permission-denied — try again next sweep.
    }
  }

  return { removed, bytes };
}

/** Run one sweep of both media directories, ignoring the throttle. */
export async function sweepMediaDirs(): Promise<CleanupResult> {
  const [generated, uploads] = await Promise.all([
    sweepDir(getGeneratedDir(), GENERATED_TTL_MS),
    sweepDir(getUploadsDir(), UPLOAD_TTL_MS),
  ]);

  // Point the database at reality: a job whose audio file just went away must
  // not keep advertising a playable URL.
  let jobsCleared = 0;
  const deletedIds = generated.removed
    .filter((n) => n.endsWith(".mp3"))
    .map((n) => `/api/tts/audio/${n.slice(0, -4)}`);

  if (deletedIds.length > 0) {
    try {
      const res = await prisma.job.updateMany({
        where: { audioUrl: { in: deletedIds } },
        data: { audioUrl: null },
      });
      jobsCleared = res.count;
    } catch (err) {
      console.error("[media-cleanup] could not clear audioUrl:", err);
    }
  }

  const result: CleanupResult = {
    generatedDeleted: generated.removed.length,
    uploadsDeleted: uploads.removed.length,
    jobsCleared,
    bytesFreed: generated.bytes + uploads.bytes,
  };

  if (result.generatedDeleted || result.uploadsDeleted) {
    console.info(
      `[media-cleanup] removed ${result.generatedDeleted} generated + ` +
        `${result.uploadsDeleted} upload entries ` +
        `(${(result.bytesFreed / 1024 / 1024).toFixed(1)}MB), ` +
        `cleared ${result.jobsCleared} audio links`
    );
  }

  return result;
}

/**
 * Fire-and-forget sweep for request handlers to call. Runs at most once per
 * hour per process and never rejects, so a handler can invoke it without
 * awaiting or guarding. Deliberately opportunistic rather than a timer: it
 * costs nothing on an idle instance and needs no scheduler.
 */
export function maybeSweepMedia(): void {
  const now = Date.now();
  if (sweepInFlight || now - lastSweepAt < SWEEP_INTERVAL_MS) return;

  lastSweepAt = now;
  sweepInFlight = sweepMediaDirs()
    .catch((err) => {
      console.error("[media-cleanup] sweep failed:", err);
      return EMPTY;
    })
    .finally(() => {
      sweepInFlight = null;
    }) as Promise<CleanupResult>;
}
