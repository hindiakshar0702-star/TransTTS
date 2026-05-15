export interface HistoryItem {
  id: string;
  type: "transcribe" | "translate" | "tts";
  title: string;
  timestamp: number;
  status: "completed" | "error";
  data: {
    // Transcribe
    fileName?: string;
    fileSize?: number;
    language?: string;
    duration?: number;
    transcript?: string;
    segmentCount?: number;
    // Translate
    sourceText?: string;
    translatedText?: string;
    sourceLang?: string;
    targetLang?: string;
    engine?: string;
    // TTS
    text?: string;
    voice?: string;
    audioUrl?: string;
  };
}

const STORAGE_KEY = "transtts_history";
const MAX_ITEMS = 50;

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: Omit<HistoryItem, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  const history = getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
  };
  history.unshift(newItem);
  if (history.length > MAX_ITEMS) history.length = MAX_ITEMS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function deleteFromHistory(id: string): void {
  if (typeof window === "undefined") return;
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getStats() {
  const history = getHistory();
  const completed = history.filter((h) => h.status === "completed");
  return {
    total: history.length,
    transcriptions: completed.filter((h) => h.type === "transcribe").length,
    translations: completed.filter((h) => h.type === "translate").length,
    ttsGenerations: completed.filter((h) => h.type === "tts").length,
    totalMinutes: completed
      .filter((h) => h.type === "transcribe" && h.data.duration)
      .reduce((sum, h) => sum + (h.data.duration || 0) / 60, 0),
  };
}
