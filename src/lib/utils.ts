export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(1) + " GB";
}

export const SUPPORTED_AUDIO = [
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/flac", "audio/ogg", "audio/m4a", "audio/x-m4a", "audio/aac",
  "audio/webm", "audio/mp4",
];

export const SUPPORTED_VIDEO = [
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/mpeg",
];

export const SUPPORTED_TYPES = [...SUPPORTED_AUDIO, ...SUPPORTED_VIDEO];

export const LANGUAGES: Record<string, { name: string; flag: string; flagCode?: string; code: string }> = {
  auto: { name: "Auto Detect", flag: "🌐", flagCode: "un", code: "auto" },
  hi: { name: "Hindi", flag: "🇮🇳", flagCode: "in", code: "hi" },
  en: { name: "English", flag: "🇺🇸", flagCode: "us", code: "en" },
  es: { name: "Spanish", flag: "🇪🇸", flagCode: "es", code: "es" },
  fr: { name: "French", flag: "🇫🇷", flagCode: "fr", code: "fr" },
  de: { name: "German", flag: "🇩🇪", flagCode: "de", code: "de" },
  ja: { name: "Japanese", flag: "🇯🇵", flagCode: "jp", code: "ja" },
  zh: { name: "Chinese", flag: "🇨🇳", flagCode: "cn", code: "zh" },
  ar: { name: "Arabic", flag: "🇸🇦", flagCode: "sa", code: "ar" },
  pt: { name: "Portuguese", flag: "🇧🇷", flagCode: "br", code: "pt" },
  ko: { name: "Korean", flag: "🇰🇷", flagCode: "kr", code: "ko" },
  it: { name: "Italian", flag: "🇮🇹", flagCode: "it", code: "it" },
  ru: { name: "Russian", flag: "🇷🇺", flagCode: "ru", code: "ru" },
  tr: { name: "Turkish", flag: "🇹🇷", flagCode: "tr", code: "tr" },
  nl: { name: "Dutch", flag: "🇳🇱", flagCode: "nl", code: "nl" },
  pl: { name: "Polish", flag: "🇵🇱", flagCode: "pl", code: "pl" },
  sv: { name: "Swedish", flag: "🇸🇪", flagCode: "se", code: "sv" },
  th: { name: "Thai", flag: "🇹🇭", flagCode: "th", code: "th" },
  vi: { name: "Vietnamese", flag: "🇻🇳", flagCode: "vn", code: "vi" },
  id: { name: "Indonesian", flag: "🇮🇩", flagCode: "id", code: "id" },
  bn: { name: "Bengali", flag: "🇧🇩", flagCode: "bd", code: "bn" },
  ta: { name: "Tamil", flag: "🇮🇳", flagCode: "in", code: "ta" },
  te: { name: "Telugu", flag: "🇮🇳", flagCode: "in", code: "te" },
  mr: { name: "Marathi", flag: "🇮🇳", flagCode: "in", code: "mr" },
  gu: { name: "Gujarati", flag: "🇮🇳", flagCode: "in", code: "gu" },
  ur: { name: "Urdu", flag: "🇵🇰", flagCode: "pk", code: "ur" },
};

export const TTS_VOICES = [
  { id: "alloy", name: "Alloy", desc: "Neutral & balanced" },
  { id: "echo", name: "Echo", desc: "Warm & resonant" },
  { id: "fable", name: "Fable", desc: "British & expressive" },
  { id: "onyx", name: "Onyx", desc: "Deep & authoritative" },
  { id: "nova", name: "Nova", desc: "Friendly & natural" },
  { id: "shimmer", name: "Shimmer", desc: "Soft & clear" },
] as const;

/**
 * Largest file the deployment will accept for transcription, in megabytes.
 *
 * Whisper's own cap is 25 MB, but on Vercel nothing that big ever reaches the
 * route: serverless functions reject a request body over ~4.5 MB at the
 * platform edge and answer 413 before any code runs. Measured against this
 * deployment — a 4 MB upload reached the route, a 5 MB upload came back 413 —
 * so the honest default is 4 MB, which leaves headroom for multipart overhead.
 *
 * A self-hosted deployment behind its own proxy has no such limit and can
 * raise this with NEXT_PUBLIC_MAX_UPLOAD_MB, up to Whisper's 25 MB.
 */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 4;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Whisper will not accept more than this, whatever the host allows. */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Most pieces a single file may be split into before the client gives up.
 *
 * Each piece is its own round trip and its own Whisper call, so a two-hour
 * recording would sit there for several minutes and burn a lot of free-tier
 * quota. Ten parts is roughly 40 minutes of MP3 or 20 of decoded audio.
 */
export const MAX_UPLOAD_PARTS = 10;

/**
 * Resolve a spoken-language *name* back to its ISO code.
 *
 * Whisper's verbose response reports the language it detected as a name
 * ("Indonesian"), while its request parameter expects a code ("id"). Feeding
 * the name straight back is rejected, so a transcript split across several
 * requests has to translate between the two to stay in one language.
 *
 * Returns null for anything outside the app's language list — Whisper knows
 * far more languages than this map does, and the caller falls back to
 * auto-detection rather than guessing.
 */
export function languageCodeFromName(name: string): string | null {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  for (const [code, entry] of Object.entries(LANGUAGES)) {
    if (code !== "auto" && entry.name.toLowerCase() === wanted) return code;
  }
  return null;
}

/**
 * Longest transcript tail passed to Whisper as context for the next part.
 * Its prompt field tops out around 224 tokens; a few hundred characters is
 * comfortably inside that and is enough to carry the language and style.
 */
export const TRANSCRIPT_CONTEXT_CHARS = 500;
