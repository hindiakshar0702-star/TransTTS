import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Served at /robots.txt. Allows the public marketing/legal pages and blocks
 * everything a crawler has no business in: the API, auth flows, and the
 * signed-in app surfaces (which redirect to /login anyway, so crawling them
 * only burns crawl budget).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/settings",
          "/record",
          "/transcribe",
          "/translate",
          "/tts",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
