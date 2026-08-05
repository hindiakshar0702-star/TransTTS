/**
 * Social-platform URL detection — pure/isomorphic (safe for client AND server).
 * Used by the transcribe page (live platform chip) and the server download
 * pipeline (validation before spawning yt-dlp).
 */

export type Platform =
  | "youtube"
  | "vimeo"
  | "twitter"
  | "facebook"
  | "instagram"
  | "pinterest";

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  twitter: "X (Twitter)",
  facebook: "Facebook",
  instagram: "Instagram",
  pinterest: "Pinterest",
};

const PLATFORM_PATTERNS: Array<{ platform: Platform; re: RegExp }> = [
  { platform: "youtube", re: /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i },
  { platform: "vimeo", re: /^(www\.|player\.)?vimeo\.com$/i },
  { platform: "twitter", re: /^(www\.|mobile\.)?(twitter\.com|x\.com)$/i },
  { platform: "facebook", re: /^(www\.|m\.|web\.)?(facebook\.com|fb\.watch)$/i },
  { platform: "instagram", re: /^(www\.)?instagram\.com$/i },
  { platform: "pinterest", re: /^(www\.|[a-z]{2}\.)?(pinterest\.(com|ca|co\.uk|fr|de|es|it|com\.au|co\.in)|pin\.it)$/i },
];

/** Detect which supported platform a URL belongs to; null when unsupported. */
export function detectPlatform(rawUrl: string): Platform | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const { platform, re } of PLATFORM_PATTERNS) {
    if (re.test(url.hostname)) return platform;
  }
  return null;
}
