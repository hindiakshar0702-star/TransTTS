import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Signed-in / credential surface: kept out of search results. The page is a
// client component, so the title and robots directives live here.
export const metadata: Metadata = pageMetadata({
  title: "Transcribe Audio",
  description: "Turn speech into accurate text with Whisper AI.",
  path: "/transcribe",
  noIndex: true,
});

export default function TranscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
