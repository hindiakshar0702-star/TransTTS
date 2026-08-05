import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description:
    "The terms governing your use of TransTTS: accounts and responsibilities, acceptable use, intellectual property, limitation of liability, termination and governing law.",
  path: "/terms-and-conditions",
});

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
