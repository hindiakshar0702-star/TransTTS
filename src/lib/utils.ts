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
