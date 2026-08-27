import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Public tool; indexable so it can answer audio-to-text searches. Title and
// canonical live here because the page is a client component.
export const metadata: Metadata = pageMetadata({
  title: "Audio & Video to Text Transcription",
  description:
    "Transcribe audio and video to accurate text with Whisper AI across 99+ languages, with timestamps. Free online transcription — no signup.",
  path: "/transcribe",
});

export default function TranscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
