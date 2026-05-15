import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "TransTTS AI — Transcribe, Translate & Generate Voice",
  description:
    "AI-powered platform using OpenAI Whisper to transcribe audio/video, translate to Hindi & 99+ languages, and generate natural AI voices.",
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
      </body>
    </html>
  );
}
