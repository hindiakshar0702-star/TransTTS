import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Public tool; indexable so it can answer translation searches. Title and
// canonical live here because the page is a client component.
export const metadata: Metadata = pageMetadata({
  title: "Free AI Translator — Hindi, English & 25+ Languages",
  description:
    "Translate text and transcripts into Hindi, English and 25+ languages with AI, and hear the result read aloud. Free online translator — no signup.",
  path: "/translate",
});

export default function TranslateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
