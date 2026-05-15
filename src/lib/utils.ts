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

export const LANGUAGES: Record<string, { name: string; flag: string; code: string }> = {
  auto: { name: "Auto Detect", flag: "🌐", code: "auto" },
  hi: { name: "Hindi", flag: "🇮🇳", code: "hi" },
  en: { name: "English", flag: "🇺🇸", code: "en" },
  es: { name: "Spanish", flag: "🇪🇸", code: "es" },
  fr: { name: "French", flag: "🇫🇷", code: "fr" },
  de: { name: "German", flag: "🇩🇪", code: "de" },
  ja: { name: "Japanese", flag: "🇯🇵", code: "ja" },
  zh: { name: "Chinese", flag: "🇨🇳", code: "zh" },
  ar: { name: "Arabic", flag: "🇸🇦", code: "ar" },
  pt: { name: "Portuguese", flag: "🇧🇷", code: "pt" },
  ko: { name: "Korean", flag: "🇰🇷", code: "ko" },
  it: { name: "Italian", flag: "🇮🇹", code: "it" },
  ru: { name: "Russian", flag: "🇷🇺", code: "ru" },
  tr: { name: "Turkish", flag: "🇹🇷", code: "tr" },
  nl: { name: "Dutch", flag: "🇳🇱", code: "nl" },
  pl: { name: "Polish", flag: "🇵🇱", code: "pl" },
  sv: { name: "Swedish", flag: "🇸🇪", code: "sv" },
  th: { name: "Thai", flag: "🇹🇭", code: "th" },
  vi: { name: "Vietnamese", flag: "🇻🇳", code: "vi" },
  id: { name: "Indonesian", flag: "🇮🇩", code: "id" },
  bn: { name: "Bengali", flag: "🇧🇩", code: "bn" },
  ta: { name: "Tamil", flag: "🇮🇳", code: "ta" },
  te: { name: "Telugu", flag: "🇮🇳", code: "te" },
  mr: { name: "Marathi", flag: "🇮🇳", code: "mr" },
  gu: { name: "Gujarati", flag: "🇮🇳", code: "gu" },
  ur: { name: "Urdu", flag: "🇵🇰", code: "ur" },
};

export const TTS_VOICES = [
  { id: "alloy", name: "Alloy", desc: "Neutral & balanced" },
  { id: "echo", name: "Echo", desc: "Warm & resonant" },
  { id: "fable", name: "Fable", desc: "British & expressive" },
  { id: "onyx", name: "Onyx", desc: "Deep & authoritative" },
  { id: "nova", name: "Nova", desc: "Friendly & natural" },
  { id: "shimmer", name: "Shimmer", desc: "Soft & clear" },
] as const;
