import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Signed-in / credential surface: kept out of search results. The page is a
// client component, so the title and robots directives live here.
export const metadata: Metadata = pageMetadata({
  title: "AI Voice Generator",
  description: "Generate natural speech from text.",
  path: "/tts",
  noIndex: true,
});

export default function TtsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
