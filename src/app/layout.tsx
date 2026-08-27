import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./landing.css";
import { ToastProvider } from "@/components/Toast";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { siteUrl, SITE_NAME } from "@/lib/seo";
import StructuredData from "@/components/StructuredData";

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

// Titled around the primary search intent (text to speech / voice generation),
// which is where the search demand is, while the tool also transcribes and
// translates. ~57 chars, so Google shows it whole.
const ROOT_TITLE = "TransTTS – Free AI Text to Speech & Hindi Voice Generator";
const ROOT_DESCRIPTION =
  "TransTTS is a free AI text-to-speech and voice generator. Convert text into natural Hindi, English and multilingual AI voices online — no signup, no cost.";

export const metadata: Metadata = {
  // Resolves every relative URL below (canonical, OG images) against the real
  // origin. Without it Next emits relative OG URLs, which crawlers ignore.
  metadataBase: new URL(siteUrl()),
  title: {
    default: ROOT_TITLE,
    // Per-route layouts supply their own title; this frames it consistently.
    template: `%s | ${SITE_NAME}`,
  },
  description: ROOT_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  // Modern search engines ignore the keywords meta for ranking; kept short and
  // honest rather than stuffed. The real signals are in the title, headings,
  // on-page copy and structured data.
  keywords: [
    "AI text to speech",
    "text to speech",
    "AI voice generator",
    "free text to speech",
    "Hindi text to speech",
    "multilingual text to speech",
    "text to voice online",
    "TTS online",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl(),
    siteName: SITE_NAME,
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
    // og:image comes from app/opengraph-image.tsx (generated at request time).
  },
  twitter: {
    card: "summary_large_image",
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Search Console verification. Set GOOGLE_SITE_VERIFICATION to the token from
  // the "HTML tag" method; omitted entirely when unset.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
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
        {/* Organization / WebSite / SoftwareApplication schema for rich results. */}
        <StructuredData />
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
