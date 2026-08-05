import type { MetadataRoute } from "next";
import { absoluteUrl, PUBLIC_ROUTES } from "@/lib/seo";

/**
 * Served at /sitemap.xml and referenced from robots.txt. Lists only the public,
 * indexable routes (see PUBLIC_ROUTES) — auth-gated app surfaces are excluded.
 * Submit this URL in Google Search Console once the site is on a real domain.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
