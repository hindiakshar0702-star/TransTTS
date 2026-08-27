import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Public tool and the primary landing page for text-to-speech searches, so it
// is indexable. The page itself is a client component, so its title and
// canonical live here.
export const metadata: Metadata = pageMetadata({
  title: "Free AI Text to Speech Online",
  description:
    "Convert text into natural AI voices in Hindi, English and 15+ languages. Free online text-to-speech and AI voice generator — no signup.",
  path: "/tts",
});

export default function TtsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
