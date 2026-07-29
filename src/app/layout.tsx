import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

export const metadata: Metadata = {
  title: "TransTTS AI — Transcribe, Translate & Generate Voice",
  description:
    "AI-powered platform using OpenAI Whisper to transcribe audio/video, translate to Hindi & 99+ languages, and generate natural AI voices.",
  other: {
    // Dynamically support Monetag verification if provided
    ...(process.env.NEXT_PUBLIC_MONETAG_VERIFICATION
      ? { monetag: process.env.NEXT_PUBLIC_MONETAG_VERIFICATION }
      : {}),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bg-grid"></div>
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
        <ToastProvider>
          <div className="page-wrapper">{children}</div>
        </ToastProvider>
        <Analytics />

        {/* Monetag Tag Integration */}
        {process.env.NEXT_PUBLIC_MONETAG_ZONE_ID && (
          <Script
            id="monetag-script"
            src={`https://alwingulla.com/act/files/micro.tag.min.js?z=${process.env.NEXT_PUBLIC_MONETAG_ZONE_ID}`}
            strategy="afterInteractive"
            data-cfasync="false"
          />
        )}
      </body>
    </html>
  );
}
