import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Signed-in / credential surface: kept out of search results. The page is a
// client component, so the title and robots directives live here.
export const metadata: Metadata = pageMetadata({
  title: "Voice Recorder",
  description: "Record audio with a live teleprompter.",
  path: "/record",
  noIndex: true,
});

export default function RecordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
