import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Signed-in / credential surface: kept out of search results. The page is a
// client component, so the title and robots directives live here.
export const metadata: Metadata = pageMetadata({
  title: "Verify Your Account",
  description: "Confirm your email address or phone number.",
  path: "/verify",
  noIndex: true,
});

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
