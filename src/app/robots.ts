import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Served at /robots.txt.
 *
 * The three tools are public in this variant and are the pages that answer the
 * primary searches ("text to speech online", "transcribe audio", "translate"),
 * so they are crawlable. Only the personal app surfaces and the API stay
 * blocked — /dashboard and /settings hold a viewer's own history and preferences
 * and rank for nothing, and /record is a live-capture surface with no indexable
 * content.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/settings", "/record"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
