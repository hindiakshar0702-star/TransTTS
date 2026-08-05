import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getUploadsDir } from "@/lib/server-utils";
import { generateId } from "@/lib/utils";
import { detectPlatform, type Platform } from "@/lib/socialPlatforms";

export { detectPlatform, type Platform };

/**
 * Social-media video → local audio file, via yt-dlp.
 *
 * yt-dlp is the de-facto extractor covering all six target platforms
 * (YouTube, Vimeo, X/Twitter, Facebook, Instagram, Pinterest). We download
 * `bestaudio` directly (m4a/webm/mp3) so no ffmpeg re-encode is needed —
 * Whisper accepts those containers as-is.
 *
 * Requirements: yt-dlp binary on PATH, or YT_DLP_PATH env pointing at it.
 *
 * ToS note: downloading from Instagram / Facebook / Pinterest / X may violate
 * those platforms' Terms of Service. Only PUBLICLY accessible content is
 * attempted — no cookies/credentials are passed, so private, age-gated, or
 * DRM-protected media simply fails. Surface this caveat in the UI.
 */

/** Max audio download size — matches the Whisper upload cap. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function ytDlpBin(): string {
  return process.env.YT_DLP_PATH || "yt-dlp";
}

export interface DownloadResult {
  filePath: string;
  platform: Platform;
}

/**
 * Download the audio track of a supported social-media video into the uploads
 * dir. Resolves with the saved file path; rejects with a user-safe Error.
 * The URL is passed as a single spawn argument (never shell-interpolated),
 * so URL contents cannot inject commands.
 */
export function downloadVideoFromUrl(
  rawUrl: string,
  onProgress?: (pct: number) => void
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const platform = detectPlatform(rawUrl);
    if (!platform) {
      reject(new Error("Unsupported URL. Paste a YouTube, Vimeo, X/Twitter, Facebook, Instagram, or Pinterest video link."));
      return;
    }

    const uploadsDir = getUploadsDir();
    const fileId = generateId();
    // yt-dlp fills %(ext)s with the real container (m4a/webm/mp3/...).
    const outTemplate = path.join(uploadsDir, `${fileId}.%(ext)s`);

    const args = [
      "--no-playlist",
      "--quiet",
      "--progress",
      "--newline",
      // Audio only, capped at the Whisper size limit; fall back to smallest A/V.
      "-f", `bestaudio[filesize<${MAX_AUDIO_BYTES}]/bestaudio/worst[filesize<${MAX_AUDIO_BYTES}]`,
      "--max-filesize", String(MAX_AUDIO_BYTES),
      "--socket-timeout", "30",
      "-o", outTemplate,
      rawUrl,
    ];

    const child = spawn(ytDlpBin(), args, {
      windowsHide: true,
      // Explicitly NO shell: the URL must never reach a shell parser.
      shell: false,
    });

    let stderrTail = "";
    const killTimer = setTimeout(() => {
      child.kill();
      reject(new Error("Video download timed out (5 minutes)."));
    }, 5 * 60 * 1000);

    child.stdout.on("data", (buf: Buffer) => {
      // yt-dlp --progress --newline emits lines like "[download]  42.1% of ..."
      const m = /\[download\]\s+(\d{1,3}(?:\.\d)?)%/.exec(buf.toString());
      if (m && onProgress) onProgress(Math.min(99, parseFloat(m[1])));
    });
    child.stderr.on("data", (buf: Buffer) => {
      stderrTail = (stderrTail + buf.toString()).slice(-2000);
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(killTimer);
      if (err.code === "ENOENT") {
        reject(new Error("yt-dlp is not installed. Install it (pip install yt-dlp) or set YT_DLP_PATH in .env.local."));
      } else {
        reject(new Error("Could not start the video downloader."));
      }
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      // Locate the produced file (extension chosen by yt-dlp).
      const produced = fs
        .readdirSync(uploadsDir)
        .find((f) => f.startsWith(fileId + "."));

      if (code === 0 && produced) {
        resolve({ filePath: path.join(uploadsDir, produced), platform });
        return;
      }
      // Clean up partial downloads.
      if (produced) fs.unlinkSync(path.join(uploadsDir, produced));

      let msg = "Could not download this video. It may be private, removed, or unsupported.";
      if (/private|login|cookies|age/i.test(stderrTail)) {
        msg = "This video is private or requires login — only publicly accessible videos can be transcribed.";
      } else if (/max-filesize|File is larger/i.test(stderrTail)) {
        msg = "This video's audio exceeds the 25MB limit. Try a shorter video.";
      } else if (/drm/i.test(stderrTail)) {
        msg = "This video is DRM-protected and cannot be transcribed.";
      }
      reject(new Error(msg));
    });
  });
}
