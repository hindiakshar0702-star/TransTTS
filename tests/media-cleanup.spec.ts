import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { sweepMediaDirs } from "../src/lib/media-cleanup";

/**
 * Disk housekeeping — this code deletes files, so the important assertion is
 * what it LEAVES ALONE. Each case writes a recent file and a backdated one into
 * the real media directories, then checks only the stale entry disappeared.
 *
 * Filenames are prefixed so a failed run can never be mistaken for real user
 * media, and everything is cleaned up afterwards.
 */

// These cases share the real media directories, so running them concurrently
// would let one test's sweep (or cleanup) delete another's fixtures.
test.describe.configure({ mode: "serial" });

const PREFIX = "pwtest-cleanup-";
const generatedDir = path.join(process.cwd(), "generated");
const uploadsDir = path.join(process.cwd(), "uploads");

/** Write a file and force its mtime to `ageMs` in the past. */
async function writeAged(dir: string, name: string, ageMs: number): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(dir, name);
  await fs.writeFile(full, "test");
  const when = new Date(Date.now() - ageMs);
  await fs.utimes(full, when, when);
  return full;
}

const exists = (p: string) => fs.access(p).then(() => true).catch(() => false);

test.afterEach(async () => {
  for (const dir of [generatedDir, uploadsDir]) {
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    await Promise.all(
      names
        .filter((n) => n.startsWith(PREFIX))
        .map((n) => fs.rm(path.join(dir, n), { recursive: true, force: true }))
    );
  }
});

test("removes generated audio past its retention window, keeps recent audio", async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const stale = await writeAged(generatedDir, `${PREFIX}stale.mp3`, 30 * DAY);
  const fresh = await writeAged(generatedDir, `${PREFIX}fresh.mp3`, 60 * 1000);

  await sweepMediaDirs();

  expect(await exists(stale), "30-day-old audio should be deleted").toBe(false);
  expect(await exists(fresh), "recent audio must survive").toBe(true);
});

test("removes abandoned uploads, keeps an upload that is still being processed", async () => {
  // uploads/ is scratch: anything older than an hour lost its request.
  const abandoned = await writeAged(uploadsDir, `${PREFIX}abandoned.mp3`, 3 * 60 * 60 * 1000);
  const inFlight = await writeAged(uploadsDir, `${PREFIX}inflight.mp3`, 30 * 1000);

  await sweepMediaDirs();

  expect(await exists(abandoned), "3-hour-old upload should be deleted").toBe(false);
  expect(await exists(inFlight), "an upload mid-transcription must survive").toBe(true);
});

test("removes a temp directory left behind by an interrupted TTS run", async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const dir = path.join(generatedDir, `${PREFIX}orphan-dir`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "audio.mp3"), "test");
  const when = new Date(Date.now() - 30 * DAY);
  await fs.utimes(dir, when, when);

  await sweepMediaDirs();

  expect(await exists(dir), "stale temp directory should be removed").toBe(false);
});

test("reports what it freed", async () => {
  const DAY = 24 * 60 * 60 * 1000;
  await writeAged(generatedDir, `${PREFIX}counted.mp3`, 30 * DAY);

  const result = await sweepMediaDirs();

  expect(result.generatedDeleted).toBeGreaterThanOrEqual(1);
  expect(result.bytesFreed).toBeGreaterThan(0);
});
