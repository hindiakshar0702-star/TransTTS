export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  language: string;
  duration: number;
  segments: TranscriptSegment[];
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export interface TTSResult {
  id: string;
  audioUrl: string;
  voice: string;
  speed: number;
  textLength: number;
}

export interface JobStatus {
  id: string;
  status: "idle" | "uploading" | "processing" | "transcribing" | "translating" | "generating" | "completed" | "error";
  progress: number;
  step: string;
  result?: TranscriptionResult | TranslationResult | TTSResult;
  error?: string;
}
