import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Signed-in / credential surface: kept out of search results. The page is a
// client component, so the title and robots directives live here.
export const metadata: Metadata = pageMetadata({
  title: "Reset Password",
  description: "Choose a new password for your TransTTS account.",
  path: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
