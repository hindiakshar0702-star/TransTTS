import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Signed-in / credential surface: kept out of search results. The page is a
// client component, so the title and robots directives live here.
export const metadata: Metadata = pageMetadata({
  title: "Profile",
  description: "Manage your TransTTS profile and security settings.",
  path: "/profile",
  noIndex: true,
});

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
