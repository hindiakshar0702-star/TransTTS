import type { Metadata } from "next";

/**
 * Shared SEO helpers. Every absolute URL (canonical, Open Graph, sitemap) is
 * derived from NEXT_PUBLIC_APP_URL so switching domains is a one-line env
 * change. Set it to the real origin in production — Google cannot index
 * localhost, and canonical/OG tags pointing at localhost are worse than none.
 */

export const SITE_NAME = "TransTTS";

/** Social card, rendered on demand by app/opengraph-image.tsx. */
export const OG_IMAGE_PATH = "/opengraph-image";

/** Absolute site origin, no trailing slash. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

interface PageSeoInput {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/about". Used for the canonical + OG url. */
  path: string;
  /** Set for pages that must never appear in search results. */
  noIndex?: boolean;
}

/**
 * Build per-page metadata with a canonical URL and Open Graph/Twitter cards.
 *
 * Most pages in this app are client components, which cannot export `metadata`
 * themselves. Each public route therefore has a small server `layout.tsx` that
 * calls this — that is what gives every page a distinct title and description
 * instead of all of them inheriting the root layout's.
 */
export function pageMetadata({ title, description, path, noIndex }: PageSeoInput): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: { canonical: url },
    // Declaring `openGraph` here opts the route out of the inherited
    // app/opengraph-image.tsx card, so point at that generated route directly.
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
    ...(noIndex
      ? { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
      : {}),
  };
}

/**
 * Public, indexable routes. Auth-gated surfaces (dashboard, profile, settings,
 * record, transcribe, translate, tts) and credential pages are deliberately
 * absent — they are either unreachable to a crawler or have no search value.
 * Keep this in sync with app/sitemap.ts consumers.
 */
export const PUBLIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  // The public tools — the pages that answer the primary searches.
  { path: "/tts", priority: 0.9, changeFrequency: "monthly" },
  { path: "/transcribe", priority: 0.9, changeFrequency: "monthly" },
  { path: "/translate", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms-and-conditions", priority: 0.3, changeFrequency: "yearly" },
];
