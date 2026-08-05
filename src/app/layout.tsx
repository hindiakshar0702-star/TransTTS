import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./landing.css";
import { ToastProvider } from "@/components/Toast";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Self-hosted via next/font: no render-blocking Google Fonts CSS @import, no
// external font requests (the old @import was also blocked by our CSP).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF8000",
};

export const metadata: Metadata = {
  title: "TransTTS AI — Transcribe, Translate & Generate Voice",
  description:
    "AI-powered platform using OpenAI Whisper to transcribe audio/video, translate to Hindi & 99+ languages, and generate natural AI voices.",
  manifest: "/manifest.json",
  applicationName: "TransTTS",
  appleWebApp: {
    capable: true,
    title: "TransTTS",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
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
    <html lang="en" className={`${jakarta.variable} ${outfit.variable}`}>
      <head>
        {/* Apply saved theme before first paint to avoid a light-mode flash.
            Key matches usePersistedState("settings_theme") → sessionStorage "transtts_settings_theme". */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=sessionStorage.getItem('transtts_settings_theme');if(t)t=JSON.parse(t);if(t==='auto')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <div className="bg-grid"></div>
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
        <ToastProvider>
          <div className="page-wrapper">{children}</div>
        </ToastProvider>
        <ServiceWorkerRegister />
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
