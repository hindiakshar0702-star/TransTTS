import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Strict builds (BUG-026).
   *
   * The previous config silently allowed type errors and lint errors
   * to ship to production by setting `ignoreBuildErrors: true`. We
   * want CI to catch regressions; failing the build locally is the
   * cheapest place to do that.
   *
   * If a future emergency hot-fix needs to bypass these gates, set
   * `STRICT_BUILDS=0` in the Vercel build environment — the override
   * is intentionally one env var so it's visible and audit-able.
   */
  eslint: {
    ignoreDuringBuilds: process.env.STRICT_BUILDS === "0",
  },
  typescript: {
    ignoreBuildErrors: process.env.STRICT_BUILDS === "0",
  },
};

export default nextConfig;
