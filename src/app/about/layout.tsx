import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so this
// server layout supplies the route's title, description and canonical URL.
export const metadata: Metadata = pageMetadata({
  title: "About Us",
  description:
    "TransTTS is a speech and language workspace: record audio, transcribe with Whisper AI, translate across languages, and generate lifelike voices. Learn what we build and why.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
